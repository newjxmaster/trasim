use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, MintTo};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("9TZMBuroxJrZvNYaVTSNhXPUzc5xdjU1WJjTLcyaVEAg");

#[program]
pub mod trasim_factory {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        global_cap_bps: u16,
        wallet_cap_holdings_bps: u16,
        wallet_cap_reserve_bps: u16,
        cooldown_secs: i64,
        fee_tier_1_bps: u16,
        fee_tier_2_bps: u16,
        fee_tier_3_bps: u16,
        fee_tier_4_bps: u16,
        fee_tier_5_bps: u16,
    ) -> Result<()> {
        let cfg = &mut ctx.accounts.config;
        cfg.admin = ctx.accounts.admin.key();
        cfg.paused = false;
        cfg.global_cap_bps = global_cap_bps;
        cfg.wallet_cap_holdings_bps = wallet_cap_holdings_bps;
        cfg.wallet_cap_reserve_bps = wallet_cap_reserve_bps;
        cfg.cooldown_secs = cooldown_secs;
        cfg.fee_tier_1_bps = fee_tier_1_bps;
        cfg.fee_tier_2_bps = fee_tier_2_bps;
        cfg.fee_tier_3_bps = fee_tier_3_bps;
        cfg.fee_tier_4_bps = fee_tier_4_bps;
        cfg.fee_tier_5_bps = fee_tier_5_bps;

        emit!(ConfigInitialized {
            admin: cfg.admin,
            global_cap_bps,
            wallet_cap_holdings_bps,
            wallet_cap_reserve_bps,
            cooldown_secs,
        });

        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        paused: bool,
        global_cap_bps: u16,
        wallet_cap_holdings_bps: u16,
        wallet_cap_reserve_bps: u16,
        cooldown_secs: i64,
        fee_tier_1_bps: u16,
        fee_tier_2_bps: u16,
        fee_tier_3_bps: u16,
        fee_tier_4_bps: u16,
        fee_tier_5_bps: u16,
    ) -> Result<()> {
        require!(global_cap_bps <= 3000, ErrorCode::BadParam);
        require!(fee_tier_5_bps <= 5000, ErrorCode::BadParam);

        let cfg = &mut ctx.accounts.config;
        cfg.paused = paused;
        cfg.global_cap_bps = global_cap_bps;
        cfg.wallet_cap_holdings_bps = wallet_cap_holdings_bps;
        cfg.wallet_cap_reserve_bps = wallet_cap_reserve_bps;
        cfg.cooldown_secs = cooldown_secs;
        cfg.fee_tier_1_bps = fee_tier_1_bps;
        cfg.fee_tier_2_bps = fee_tier_2_bps;
        cfg.fee_tier_3_bps = fee_tier_3_bps;
        cfg.fee_tier_4_bps = fee_tier_4_bps;
        cfg.fee_tier_5_bps = fee_tier_5_bps;

        emit!(ConfigUpdated {
            admin: cfg.admin,
            paused,
            global_cap_bps,
        });

        Ok(())
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        curve_a: u64,
        curve_b: u64,
        reserve_bps: u16,
        platform_bps: u16,
        creator_bps: u16,
        season_id: u64,
    ) -> Result<()> {
        require!(
            (reserve_bps as u32 + platform_bps as u32 + creator_bps as u32) == 10_000,
            ErrorCode::BadBps
        );

        let config = &ctx.accounts.config;
        require!(!config.paused, ErrorCode::Paused);

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.token_mint = ctx.accounts.token_mint.key();
        market.exit_reserve = ctx.accounts.exit_reserve.key();
        market.treasury = ctx.accounts.treasury.key();
        market.creator_stream = ctx.accounts.creator_stream.key();
        market.curve_a = curve_a;
        market.curve_b = curve_b;
        market.reserve_bps = reserve_bps;
        market.platform_bps = platform_bps;
        market.creator_bps = creator_bps;
        market.supply = 0;
        market.global_window_start_ts = Clock::get()?.unix_timestamp;
        market.global_sold_in_window_lamports = 0;
        market.season_id = season_id;
        market.created_at_ts = Clock::get()?.unix_timestamp;

        emit!(MarketCreated {
            market: market.key(),
            creator: market.creator,
            token_mint: market.token_mint,
            curve_a,
            curve_b,
            season_id,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + std::mem::size_of::<GlobalConfig>(),
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        has_one = admin,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + std::mem::size_of::<Market>(),
        seeds = [b"market", token_mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        space = 82,
        mint::decimals = 9,
        mint::authority = market,
        seeds = [b"mint", market.key().as_ref()],
        bump
    )]
    pub token_mint: Account<'info, Mint>,

    #[account(
        seeds = [b"exit_reserve", market.key().as_ref()],
        bump
    )]
    pub exit_reserve: SystemAccount<'info>,

    #[account(
        seeds = [b"treasury", market.key().as_ref()],
        bump
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        seeds = [b"creator_stream", market.key().as_ref()],
        bump
    )]
    pub creator_stream: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
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

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub global_cap_bps: u16,
    pub wallet_cap_holdings_bps: u16,
    pub wallet_cap_reserve_bps: u16,
    pub cooldown_secs: i64,
}

#[event]
pub struct ConfigUpdated {
    pub admin: Pubkey,
    pub paused: bool,
    pub global_cap_bps: u16,
}

#[event]
pub struct MarketCreated {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub curve_a: u64,
    pub curve_b: u64,
    pub season_id: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bad parameter")]
    BadParam,
    #[msg("Bad basis points sum")]
    BadBps,
    #[msg("System is paused")]
    Paused,
}
