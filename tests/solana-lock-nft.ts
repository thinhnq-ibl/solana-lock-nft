import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaLockNft } from "../target/types/solana_lock_nft";
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createMint,
  mintTo,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";

let accountPrivKey = [
  10, 253, 54, 31, 72, 166, 218, 19, 232, 230, 34, 160, 61, 168, 131, 124, 210,
  200, 176, 27, 106, 10, 193, 194, 185, 33, 2, 177, 22, 104, 131, 211, 115, 37,
  129, 62, 106, 8, 148, 244, 136, 49, 12, 128, 247, 75, 199, 128, 229, 66, 147,
  206, 80, 68, 111, 148, 147, 59, 168, 48, 7, 232, 195, 2,
].slice(0, 32);
let admin_wallet = anchor.web3.Keypair.fromSeed(
  Uint8Array.from(accountPrivKey)
);
let accountPrivKey2 = [
  39, 160, 120, 239, 225, 24, 95, 19, 92, 144, 94, 226, 150, 216, 128, 201, 145,
  143, 222, 236, 8, 183, 212, 19, 29, 153, 5, 127, 51, 187, 117, 47, 213, 34,
  250, 84, 112, 151, 98, 64, 219, 21, 18, 214, 100, 71, 241, 80, 54, 111, 100,
  12, 183, 247, 204, 39, 35, 122, 164, 131, 136, 178, 202, 159,
].slice(0, 32);
let user1_wallet = anchor.web3.Keypair.fromSeed(
  Uint8Array.from(accountPrivKey2)
);

let accountPrivKey3 = [
  208, 9, 246, 7, 238, 14, 83, 117, 236, 179, 36, 54, 237, 13, 104, 193, 60,
  137, 202, 241, 32, 173, 112, 53, 38, 54, 162, 60, 247, 196, 20, 12, 110, 170,
  242, 244, 167, 83, 110, 255, 131, 29, 55, 183, 201, 214, 68, 218, 186, 57, 35,
  15, 188, 234, 46, 215, 78, 161, 229, 205, 222, 5, 133, 123,
].slice(0, 32);
let user2_wallet = anchor.web3.Keypair.fromSeed(
  Uint8Array.from(accountPrivKey3)
);

describe("solana-lock-nft", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SolanaLockNft as Program<SolanaLockNft>;

  it("Is initialized!", async () => {
    // Add your test here.
    let transaction = new anchor.web3.Transaction();
    let con = program.provider.connection;
    let programId = program.programId;
    await con.requestAirdrop(admin_wallet.publicKey, 10000000000);

    await con.requestAirdrop(user1_wallet.publicKey, 10000000000);

    await con.requestAirdrop(user2_wallet.publicKey, 10000000000);

    let mintA = await createMint(
      con,
      admin_wallet,
      admin_wallet.publicKey,
      null,
      0
    );

    let myToken_acctA = await getOrCreateAssociatedTokenAccount(
      con,
      admin_wallet,
      mintA,
      admin_wallet.publicKey
    );

    await mintTo(
      con,
      admin_wallet,
      mintA,
      myToken_acctA.address,
      admin_wallet.publicKey,
      5
    );
    let amount = 1;

    let beneficiaryAta = await getOrCreateAssociatedTokenAccount(
      con,
      user1_wallet,
      myToken_acctA.mint,
      user1_wallet.publicKey
    );

    // state PDA for token
    const [user_pda_state, bump_state] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          admin_wallet.publicKey.toBuffer(),
          beneficiaryAta.address.toBuffer(),
          Buffer.from("state"),
        ],
        programId
      );

    /// token PDA
    const [usertokenpda, bump_token] =
      await anchor.web3.PublicKey.findProgramAddress(
        [admin_wallet.publicKey.toBuffer(), beneficiaryAta.address.toBuffer()],
        programId
      );

    if ((await con.getAccountInfo(user_pda_state)) == null) {
      transaction.add(
        await program.methods
          .initializestatepda(
            bump_state,
            bump_token,
            admin_wallet.publicKey,
            beneficiaryAta.address
          )
          .accounts({
            statepda: user_pda_state,
            owner: admin_wallet.publicKey,
            beneficiary: beneficiaryAta.address,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin_wallet])
          .instruction()
      );
    }

    await sendAndConfirmTransaction(con, transaction, [admin_wallet]);

    let transaction1 = new anchor.web3.Transaction();

    if ((await con.getAccountInfo(usertokenpda)) == null) {
      transaction1.add(
        await program.methods
          .initialisetokenpda()
          .accounts({
            tokenpda: usertokenpda,
            statepda: user_pda_state,
            mint: mintA,
            owner: admin_wallet.publicKey,
            beneficiary: beneficiaryAta.address,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([admin_wallet])
          .instruction()
      );
    }

    await sendAndConfirmTransaction(con, transaction1, [admin_wallet]);

    let transaction2 = new anchor.web3.Transaction();

    /// call for token transfer from user to PDA token Account
    transaction2.add(
      await createTransferInstruction(
        myToken_acctA.address,
        usertokenpda,
        admin_wallet.publicKey,
        amount
      )
    );

    await sendAndConfirmTransaction(con, transaction2, [admin_wallet]);

    let transaction3 = new anchor.web3.Transaction();

    /// call for token transfer from user to PDA token Account
    transaction3.add(
      await program.methods
        .unlock()
        .accounts({
          statepda: user_pda_state,
          owner: admin_wallet.publicKey,
        })
        .signers([admin_wallet])
        .instruction()
    );

    await sendAndConfirmTransaction(con, transaction3, [admin_wallet]);

    let transaction4 = new anchor.web3.Transaction();

    const [user_pda_state2, bump1] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          admin_wallet.publicKey.toBuffer(),
          beneficiaryAta.address.toBuffer(),
          Buffer.from("state"),
        ],
        programId
      );

    const [usertokenpda2, bump2] =
      await anchor.web3.PublicKey.findProgramAddress(
        [admin_wallet.publicKey.toBuffer(), beneficiaryAta.address.toBuffer()],
        programId
      );

    if ((await con.getAccountInfo(usertokenpda2)) == null) {
      console.log("token  pda does not exist");
    }

    transaction4.add(
      await program.methods
        .claimtoken(new anchor.BN(amount))
        .accounts({
          tokenpda: usertokenpda2,
          statepda: user_pda_state2,
          beneficiary: beneficiaryAta.address,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user1_wallet])
        .instruction()
    );

    await sendAndConfirmTransaction(con, transaction4, [user1_wallet]);
  });
});
