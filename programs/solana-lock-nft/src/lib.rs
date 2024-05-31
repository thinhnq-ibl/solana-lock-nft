use anchor_lang::prelude::*;
use anchor_spl::token::Transfer;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

declare_id!("HdeXbQhJHqPGJ8gW5fG2cn9713T3BL5s4HN4ReYqWtem");

#[program]
pub mod solana_lock_nft {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn initializestatepda(
        ctx: Context<Initialisedstatepda>,
        _bump: u8,
        admin: Pubkey,
        beneficiary: Pubkey,
    ) -> Result<()> {
        msg!("state got Initialised");
        ctx.accounts.statepda.admin = admin;
        ctx.accounts.statepda.lock = 1;
        ctx.accounts.statepda.beneficiary = beneficiary;
        Ok(())
    }

    pub fn initialisetokenpda(ctx: Context<Initialisetokenpda>, _bump1: u8) -> Result<()> {
        msg!("token got Initialised");
        let pda = ctx.accounts.tokenpda.key();
        msg!("token pda : {}", pda);
        Ok(())
    }

    pub fn unlock(ctx: Context<Unlockstatepda>) -> Result<()> {
        msg!("token got Initialised");
        if ctx.accounts.statepda.admin == ctx.accounts.owner.key() {
            ctx.accounts.statepda.lock = 0;
        } else {
            panic!("not admin !")
        }
        Ok(())
    }

    pub fn sendtokenwinner(ctx: Context<SendTokenWinner>, _bump1: u8, _amount: u64) -> Result<()> {
        msg!("token transfer to winner started from backend...");

        if ctx.accounts.statepda.lock == 1 {
            panic!("sc is locked!")
        }

        let bump_vector = _bump1.to_le_bytes();
        let dep = &mut ctx.accounts.beneficiary.key();
        let sender = &ctx.accounts.sender;
        let inner = vec![
            sender.key.as_ref(),
            dep.as_ref(),
            "state".as_ref(),
            bump_vector.as_ref(),
        ];
        let outer = vec![inner.as_slice()];
        let transfer_instruction = Transfer {
            from: ctx.accounts.tokenpda.to_account_info(),
            to: ctx.accounts.wallet_to_deposit_to.to_account_info(),
            authority: ctx.accounts.statepda.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
            outer.as_slice(),
        );

        msg!("trasnfer call start");

        anchor_spl::token::transfer(cpi_ctx, _amount)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[account]
#[derive(Default)]
pub struct State {
    bump: u8,
    amount: u64,
    lock: u8,
    admin: Pubkey,
    beneficiary: Pubkey,
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct Initialisedstatepda<'info> {
    #[account(
        init,
        payer = owner,
        seeds=[owner.key.as_ref(),beneficiary.key().as_ref(),"state".as_ref()],
        bump,
        space=200
    )]
    statepda: Account<'info, State>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub beneficiary: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(_bump : u8)]
pub struct Initialisetokenpda<'info> {
    #[account(
        init,
        seeds = [owner.key.as_ref(),beneficiary.key().as_ref()],
        bump,
        payer = owner,
        token::mint = mint,
        token::authority = statepda,
     )]
    pub tokenpda: Account<'info, TokenAccount>,
    pub statepda: Account<'info, State>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut)]
    pub beneficiary: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Unlockstatepda<'info> {
    #[account(mut)]
    pub statepda: Account<'info, State>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct SendTokenWinner<'info> {
    #[account(mut)]
    pub tokenpda: Account<'info, TokenAccount>,
    pub statepda: Account<'info, State>,
    #[account(mut)]
    pub wallet_to_deposit_to: Account<'info, TokenAccount>,
    /// CHECK not read write to this account
    pub sender: AccountInfo<'info>,
    pub beneficiary: Account<'info, TokenAccount>,
    #[account(mut)]
    /// CHECK not read write to this account
    pub reciever: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
}
