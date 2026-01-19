use anchor_lang::prelude::*;

declare_id!("3DvyQntgVJWCF77LJcFe2LvjoG7mKnEpfjjzk3KtVH3B");

#[program]
pub mod trasim_rewards {
    use super::*;

    pub fn create_season(ctx: Context<CreateSeason>, season_id: u64, start_ts: i64, end_ts: i64) -> Result<()> {
        require!(end_ts > start_ts, ErrorCode::BadParam);

        let season = &mut ctx.accounts.season;
        season.id = season_id;
        season.start_ts = start_ts;
        season.end_ts = end_ts;
        season.reward_pool_lamports = 0;
        season.status = 0;

        emit!(SeasonCreated {
            season_id,
            start_ts,
            end_ts,
        });

        Ok(())
    }

    pub fn end_season(ctx: Context<EndSeason>) -> Result<()> {
        let season = &mut ctx.accounts.season;
        season.status = 1;

        emit!(SeasonEnded {
            season_id: season.id,
        });

        Ok(())
    }

    pub fn fund_season_pool(ctx: Context<FundSeasonPool>, lamports: u64) -> Result<()> {
        let season = &mut ctx.accounts.season;

        **ctx.accounts.treasury_vault.to_account_info().try_borrow_mut_lamports()? -= lamports;
        season.reward_pool_lamports = season.reward_pool_lamports.checked_add(lamports).ok_or(ErrorCode::MathOverflow)?;

        emit!(SeasonFunded {
            season_id: season.id,
            amount: lamports,
            pool_balance: season.reward_pool_lamports,
        });

        Ok(())
    }

    pub fn withdraw_treasury(ctx: Context<WithdrawTreasury>, lamports: u64) -> Result<()> {
        **ctx.accounts.treasury_vault.to_account_info().try_borrow_mut_lamports()? -= lamports;
        **ctx.accounts.recipient.to_account_info().try_borrow_mut_lamports()? += lamports;

        emit!(TreasuryWithdrawn {
            recipient: ctx.accounts.recipient.key(),
            amount: lamports,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateSeason<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        constraint = config.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + std::mem::size_of::<Season>(),
        seeds = [b"season", &season_id.to_le_bytes()],
        bump
    )]
    pub season: Account<'info, Season>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndSeason<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        constraint = config.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [b"season", season.id.to_le_bytes().as_ref()],
        bump
    )]
    pub season: Account<'info, Season>,
}

#[derive(Accounts)]
pub struct FundSeasonPool<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        constraint = config.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub treasury_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub season: Account<'info, Season>,
}

#[derive(Accounts)]
pub struct WithdrawTreasury<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        constraint = config.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub admin: Signer<'info>,

    #[account(mut)]
    pub treasury_vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
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
pub struct Season {
    pub id: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub reward_pool_lamports: u64,
    pub status: u8,
}

#[event]
pub struct SeasonCreated {
    pub season_id: u64,
    pub start_ts: i64,
    pub end_ts: i64,
}

#[event]
pub struct SeasonEnded {
    pub season_id: u64,
}

#[event]
pub struct SeasonFunded {
    pub season_id: u64,
    pub amount: u64,
    pub pool_balance: u64,
}

#[event]
pub struct TreasuryWithdrawn {
    pub recipient: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Bad parameter")]
    BadParam,
    #[msg("Not authorized")]
    NotAuthorized,
}
