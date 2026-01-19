use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("67RSFmYbP9RMPVDpoBqa6g2GM9RxsHDEt6A4qf7aU1yz");

#[program]
pub mod trasim_market {
    use super::*;

    pub fn buy(ctx: Context<Buy>, token_amount: u64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let config = &ctx.accounts.config;

        require!(!config.paused, ErrorCode::Paused);

        let cost = buy_cost_lamports(market.supply, token_amount, market.curve_a, market.curve_b)?;

        let (to_reserve, to_treasury, to_creator) = split_cost(
            cost,
            market.reserve_bps,
            market.platform_bps,
            market.creator_bps,
        )?;

        let now = Clock::get()?.unix_timestamp;
        reset_if_expired(&mut market.global_window_start_ts, &mut market.global_sold_in_window_lamports, now);

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.exit_reserve.to_account_info(),
                },
            ),
            to_reserve,
        )?;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.treasury.to_account_info(),
                },
            ),
            to_treasury,
        )?;

        anchor_lang::system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                anchor_lang::system_program::Transfer {
                    from: ctx.accounts.buyer.to_account_info(),
                    to: ctx.accounts.creator_stream.to_account_info(),
                },
            ),
            to_creator,
        )?;

        let seeds = &[
            b"market",
            market.token_mint.as_ref(),
            &[ctx.bumps.market],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.token_mint.to_account_info(),
                to: ctx.accounts.buyer_token_account.to_account_info(),
                authority: market.to_account_info(),
            },
            signer_seeds,
        );
        token::mint_to(cpi_ctx, token_amount)?;

        market.supply = market.supply.checked_add(token_amount).ok_or(ErrorCode::MathOverflow)?;

        let price_now = price_lamports(market.supply, market.curve_a, market.curve_b)?;

        emit!(TradeEvent {
            market: market.key(),
            wallet: ctx.accounts.buyer.key(),
            side: 0,
            token_amount,
            sol_gross: cost,
            sol_net: cost,
            fee: 0,
            fee_tier: 0,
            post_supply: market.supply,
            post_price: price_now,
            ts: now,
        });

        Ok(())
    }

    pub fn sell(ctx: Context<Sell>, token_amount: u64) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let user_state = &mut ctx.accounts.user_state;
        let config = &ctx.accounts.config;

        require!(!config.paused, ErrorCode::Paused);
        require!(token_amount > 0, ErrorCode::InvalidDelta);

        let now = Clock::get()?.unix_timestamp;

        reset_if_expired(&mut market.global_window_start_ts, &mut market.global_sold_in_window_lamports, now);
        reset_if_expired(&mut user_state.window_start_ts, &mut user_state.sold_in_window_lamports, now);

        let exit_reserve_lamports = ctx.accounts.exit_reserve.to_account_info().lamports();
        let wallet_token_balance = ctx.accounts.seller_token_account.amount;

        let price_now = price_lamports(market.supply, market.curve_a, market.curve_b)?;
        let wallet_value = (wallet_token_balance as u128)
            .checked_mul(price_now as u128)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        let cap_by_holdings = (wallet_value as u128)
            .checked_mul(config.wallet_cap_holdings_bps as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        let cap_by_reserve = (exit_reserve_lamports as u128)
            .checked_mul(config.wallet_cap_reserve_bps as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        let wallet_cap = cap_by_holdings.min(cap_by_reserve);

        let gross_payout = sell_proceeds_lamports(market.supply, token_amount, market.curve_a, market.curve_b)?;

        let used_amount = user_state.sold_in_window_lamports.checked_add(gross_payout).ok_or(ErrorCode::MathOverflow)?;
        let fee_bps = fee_bps(used_amount, wallet_cap, config)?;

        let fee = (gross_payout as u128)
            .checked_mul(fee_bps as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        let net_payout = gross_payout.checked_sub(fee).ok_or(ErrorCode::MathOverflow)?;

        require!(
            now.saturating_sub(user_state.last_sell_ts) >= config.cooldown_secs,
            ErrorCode::CooldownActive
        );

        let global_cap = (exit_reserve_lamports as u128)
            .checked_mul(config.global_cap_bps as u128)
            .ok_or(ErrorCode::MathOverflow)?
            .checked_div(10_000)
            .ok_or(ErrorCode::MathOverflow)? as u64;

        require!(
            market
                .global_sold_in_window_lamports
                .checked_add(net_payout)
                .ok_or(ErrorCode::MathOverflow)?
                <= global_cap,
            ErrorCode::GlobalSellCapExceeded
        );

        require!(
            user_state
                .sold_in_window_lamports
                .checked_add(net_payout)
                .ok_or(ErrorCode::MathOverflow)?
                <= wallet_cap,
            ErrorCode::WalletSellCapExceeded
        );

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    from: ctx.accounts.seller_token_account.to_account_info(),
                    authority: ctx.accounts.seller.to_account_info(),
                },
            ),
            token_amount,
        )?;

        **ctx.accounts.exit_reserve.to_account_info().try_borrow_mut_lamports()? -= net_payout;
        **ctx.accounts.seller.to_account_info().try_borrow_mut_lamports()? += net_payout;

        market.supply = market.supply.checked_sub(token_amount).ok_or(ErrorCode::MathOverflow)?;
        market.global_sold_in_window_lamports = market.global_sold_in_window_lamports.checked_add(net_payout).ok_or(ErrorCode::MathOverflow)?;

        user_state.sold_in_window_lamports = user_state.sold_in_window_lamports.checked_add(net_payout).ok_or(ErrorCode::MathOverflow)?;
        user_state.last_sell_ts = now;

        let post_price = price_lamports(market.supply, market.curve_a, market.curve_b)?;

        emit!(TradeEvent {
            market: market.key(),
            wallet: ctx.accounts.seller.key(),
            side: 1,
            token_amount,
            sol_gross: gross_payout,
            sol_net: net_payout,
            fee,
            fee_tier: fee_bps,
            post_supply: market.supply,
            post_price,
            ts: now,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"market", token_mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    #[account(
        mut,
        address = market.exit_reserve @ ErrorCode::InvalidVault
    )]
    pub exit_reserve: UncheckedAccount<'info>,

    #[account(
        mut,
        address = market.treasury @ ErrorCode::InvalidVault
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        mut,
        address = market.creator_stream @ ErrorCode::InvalidVault
    )]
    pub creator_stream: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"mint", market.key().as_ref()],
        bump
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = token_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Sell<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"market", token_mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        init_if_needed,
        payer = seller,
        space = 8 + std::mem::size_of::<UserMarketState>(),
        seeds = [b"user_state", market.key().as_ref(), seller.key().as_ref()],
        bump
    )]
    pub user_state: Account<'info, UserMarketState>,

    #[account(
        mut,
        address = market.exit_reserve @ ErrorCode::InvalidVault
    )]
    pub exit_reserve: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"mint", market.key().as_ref()],
        bump
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub paused: bool,
    pub global_cap_bps: u16,
    pub wallet_cap_holdings_bps: u16,
    pub wallet_cap_reserve_bps: u16,
    pub cooldown_secs: i64,
    pub fee_tier_1_bps: u16,
    pub fee_tier_2_bps: u16,
    pub fee_tier_3_bps: u16,
    pub fee_tier_4_bps: u16,
    pub fee_tier_5_bps: u16,
}

#[account]
pub struct Market {
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub exit_reserve: Pubkey,
    pub treasury: Pubkey,
    pub creator_stream: Pubkey,
    pub curve_a: u64,
    pub curve_b: u64,
    pub reserve_bps: u16,
    pub platform_bps: u16,
    pub creator_bps: u16,
    pub supply: u64,
    pub global_window_start_ts: i64,
    pub global_sold_in_window_lamports: u64,
    pub season_id: u64,
    pub created_at_ts: i64,
}

#[account]
pub struct UserMarketState {
    pub wallet: Pubkey,
    pub market: Pubkey,
    pub window_start_ts: i64,
    pub sold_in_window_lamports: u64,
    pub last_sell_ts: i64,
}

#[event]
pub struct TradeEvent {
    pub market: Pubkey,
    pub wallet: Pubkey,
    pub side: u8,
    pub token_amount: u64,
    pub sol_gross: u64,
    pub sol_net: u64,
    pub fee: u64,
    pub fee_tier: u16,
    pub post_supply: u64,
    pub post_price: u64,
    pub ts: i64,
}

fn price_lamports(supply: u64, a: u64, b: u64) -> Result<u64> {
    let result = (supply as u128)
        .checked_mul(a as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(b as u128)
        .ok_or(ErrorCode::MathOverflow)?;
    u64::try_from(result).map_err(|_| ErrorCode::MathOverflow.into())
}

fn buy_cost_lamports(s: u64, d: u64, a: u64, b: u64) -> Result<u64> {
    let s128 = s as u128;
    let d128 = d as u128;
    let a128 = a as u128;
    let b128 = b as u128;

    let new_s = s128.checked_add(d128).ok_or(ErrorCode::MathOverflow)?;

    let term_sq = new_s
        .checked_mul(new_s)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_sub(s128.checked_mul(s128).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    let cost = a128
        .checked_mul(term_sq)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(2)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(b128.checked_mul(d128).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    u64::try_from(cost).map_err(|_| ErrorCode::MathOverflow.into())
}

fn sell_proceeds_lamports(s: u64, d: u64, a: u64, b: u64) -> Result<u64> {
    require!(d <= s, ErrorCode::InvalidDelta);

    let s128 = s as u128;
    let d128 = d as u128;
    let a128 = a as u128;
    let b128 = b as u128;

    let new_s = s128.checked_sub(d128).ok_or(ErrorCode::MathOverflow)?;

    let term_sq = s128
        .checked_mul(s128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_sub(new_s.checked_mul(new_s).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    let proceeds = a128
        .checked_mul(term_sq)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(2)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_add(b128.checked_mul(d128).ok_or(ErrorCode::MathOverflow)?)
        .ok_or(ErrorCode::MathOverflow)?;

    u64::try_from(proceeds).map_err(|_| ErrorCode::MathOverflow.into())
}

fn split_cost(cost: u64, reserve_bps: u16, platform_bps: u16, creator_bps: u16) -> Result<(u64, u64, u64)> {
    require!(
        (reserve_bps as u32 + platform_bps as u32 + creator_bps as u32) == 10_000,
        ErrorCode::BadBps
    );

    let c = cost as u128;
    let r = (c.checked_mul(reserve_bps as u128).ok_or(ErrorCode::MathOverflow)?.checked_div(10_000).ok_or(ErrorCode::MathOverflow)?) as u64;
    let p = (c.checked_mul(platform_bps as u128).ok_or(ErrorCode::MathOverflow)?.checked_div(10_000).ok_or(ErrorCode::MathOverflow)?) as u64;

    let k = cost.checked_sub(r).ok_or(ErrorCode::MathOverflow)?.checked_sub(p).ok_or(ErrorCode::MathOverflow)?;

    Ok((r, p, k))
}

fn reset_if_expired(start_ts: &mut i64, sold: &mut u64, now: i64) {
    const WINDOW: i64 = 24 * 60 * 60;
    if now.saturating_sub(*start_ts) >= WINDOW {
        *start_ts = now;
        *sold = 0;
    }
}

fn fee_bps(used: u64, cap: u64, cfg: &GlobalConfig) -> Result<u16> {
    require!(cap > 0, ErrorCode::InvalidCap);
    let usage = (used as u128)
        .checked_mul(100)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(cap as u128)
        .ok_or(ErrorCode::MathOverflow)? as u64;

    let bps = match usage {
        0..=20 => cfg.fee_tier_1_bps,
        21..=40 => cfg.fee_tier_2_bps,
        41..=60 => cfg.fee_tier_3_bps,
        61..=80 => cfg.fee_tier_4_bps,
        _ => cfg.fee_tier_5_bps,
    };
    Ok(bps)
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid delta")]
    InvalidDelta,
    #[msg("Global sell cap exceeded")]
    GlobalSellCapExceeded,
    #[msg("Wallet sell cap exceeded")]
    WalletSellCapExceeded,
    #[msg("Sell cooldown active")]
    CooldownActive,
    #[msg("Invalid cap")]
    InvalidCap,
    #[msg("Bad basis points sum")]
    BadBps,
    #[msg("Bad parameter")]
    BadParam,
    #[msg("System is paused")]
    Paused,
    #[msg("Invalid vault")]
    InvalidVault,
}
