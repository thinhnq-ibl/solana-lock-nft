use anchor_lang::prelude::*;

declare_id!("ALMY4h8se9Q33wouHCWw61rByF8n5YftFoGuwDtYBenG");

#[program]
pub mod lock_nft {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
