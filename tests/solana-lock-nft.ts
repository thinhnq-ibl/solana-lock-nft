import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaLockNft } from "../target/types/solana_lock_nft";

import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
} from "@solana/spl-token";
import { assert, expect } from "chai";

import {
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  SYSVAR_RENT_PUBKEY,
  MAX_SEED_LENGTH,
} from "@solana/web3.js";
import { use } from "chai";
import { sendAndConfirmTransaction } from "@solana/web3.js";
import {
  AccountLayout,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createAssociatedTokenAccountInstruction,
  getAccount,
  createInitializeMintInstruction,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  transfer,
} from "@solana/spl-token";

let accountPrivKey = [
  10, 253, 54, 31, 72, 166, 218, 19, 232, 230, 34, 160, 61, 168, 131, 124, 210,
  200, 176, 27, 106, 10, 193, 194, 185, 33, 2, 177, 22, 104, 131, 211, 115, 37,
  129, 62, 106, 8, 148, 244, 136, 49, 12, 128, 247, 75, 199, 128, 229, 66, 147,
  206, 80, 68, 111, 148, 147, 59, 168, 48, 7, 232, 195, 2,
].slice(0, 32);
let User_Wallet = anchor.web3.Keypair.fromSeed(Uint8Array.from(accountPrivKey));
let winnerPrivKey = [
  39, 160, 120, 239, 225, 24, 95, 19, 92, 144, 94, 226, 150, 216, 128, 201, 145,
  143, 222, 236, 8, 183, 212, 19, 29, 153, 5, 127, 51, 187, 117, 47, 213, 34,
  250, 84, 112, 151, 98, 64, 219, 21, 18, 214, 100, 71, 241, 80, 54, 111, 100,
  12, 183, 247, 204, 39, 35, 122, 164, 131, 136, 178, 202, 159,
].slice(0, 32);
let winner_wallet = anchor.web3.Keypair.fromSeed(
  Uint8Array.from(winnerPrivKey)
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
    let token_airdrop = await con.requestAirdrop(
      User_Wallet.publicKey,
      10000000000
    );
    await con.confirmTransaction(token_airdrop);

    let token_airdrop1 = await con.requestAirdrop(
      winner_wallet.publicKey,
      10000000000
    );
    await con.confirmTransaction(token_airdrop1);

    let mintA = await createMint(
      con,
      User_Wallet,
      User_Wallet.publicKey,
      null,
      0
    );
    let myToken_acctA = await getOrCreateAssociatedTokenAccount(
      con,
      User_Wallet,
      mintA,
      User_Wallet.publicKey
    );

    await mintTo(
      con,
      User_Wallet,
      mintA,
      myToken_acctA.address,
      User_Wallet.publicKey,
      5
    );
    let amount = 1;

    let wallet_to_deposit_to = await getOrCreateAssociatedTokenAccount(
      con,
      winner_wallet,
      myToken_acctA.mint,
      winner_wallet.publicKey
    );

    // state PDA for token
    const [user_pda_state, bump_state] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          User_Wallet.publicKey.toBuffer(),
          wallet_to_deposit_to.address.toBuffer(),
          Buffer.from("state"),
        ],
        programId
      );

    if ((await con.getAccountInfo(user_pda_state)) == null) {
      transaction.add(
        await program.methods
          .initializestatepda(
            bump_state,
            User_Wallet.publicKey,
            wallet_to_deposit_to.address
          )
          .accounts({
            statepda: user_pda_state,
            owner: User_Wallet.publicKey,
            beneficiary: wallet_to_deposit_to.address,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([User_Wallet])
          .instruction()
      );
    }

    await sendAndConfirmTransaction(con, transaction, [User_Wallet]);

    let transaction1 = new anchor.web3.Transaction();

    /// token PDA
    const [usertokenpda, bump_token] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          User_Wallet.publicKey.toBuffer(),
          wallet_to_deposit_to.address.toBuffer(),
        ],
        programId
      );

    if ((await con.getAccountInfo(usertokenpda)) == null) {
      transaction1.add(
        await program.methods
          .initialisetokenpda(bump_token)
          .accounts({
            tokenpda: usertokenpda,
            statepda: user_pda_state,
            mint: mintA,
            owner: User_Wallet.publicKey,
            beneficiary: wallet_to_deposit_to.address,
            systemProgram: anchor.web3.SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([User_Wallet])
          .instruction()
      );
    }

    await sendAndConfirmTransaction(con, transaction1, [User_Wallet]);

    let transaction2 = new anchor.web3.Transaction();

    /// call for token transfer from user to PDA token Account
    transaction2.add(
      await createTransferInstruction(
        myToken_acctA.address,
        usertokenpda,
        User_Wallet.publicKey,
        amount
      )
    );

    await sendAndConfirmTransaction(con, transaction2, [User_Wallet]);

    let transaction3 = new anchor.web3.Transaction();

    /// call for token transfer from user to PDA token Account
    transaction3.add(
      await program.methods
        .unlock()
        .accounts({
          statepda: user_pda_state,
          owner: User_Wallet.publicKey,
        })
        .signers([User_Wallet])
        .instruction()
    );

    await sendAndConfirmTransaction(con, transaction3, [User_Wallet]);

    let transaction4 = new anchor.web3.Transaction();

    const [user_pda_state2, bump1] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          User_Wallet.publicKey.toBuffer(),
          wallet_to_deposit_to.address.toBuffer(),
          Buffer.from("state"),
        ],
        programId
      );

    const [usertokenpda2, bump2] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          User_Wallet.publicKey.toBuffer(),
          wallet_to_deposit_to.address.toBuffer(),
        ],
        programId
      );

    if ((await con.getAccountInfo(usertokenpda2)) == null) {
      console.log("token  pda does not exist");
    }

    transaction4.add(
      await program.methods
        .sendtokenwinner(bump1, new anchor.BN(amount))
        .accounts({
          tokenpda: usertokenpda2,
          statepda: user_pda_state2,
          walletToDepositTo: wallet_to_deposit_to.address,
          sender: User_Wallet.publicKey,
          beneficiary: wallet_to_deposit_to.address,
          reciever: winner_wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([winner_wallet])
        .instruction()
    );

    await sendAndConfirmTransaction(con, transaction4, [winner_wallet]);
  });
});
