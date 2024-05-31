use anchor_lang::prelude::*;

declare_id!("HdeXbQhJHqPGJ8gW5fG2cn9713T3BL5s4HN4ReYqWtem");

#[program]
pub mod solana_lock_nft {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
