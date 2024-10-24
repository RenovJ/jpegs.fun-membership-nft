import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { JpegsfunNft } from "../target/types/jpegsfun_nft";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
} from "@solana/web3.js";
import {
  printV1,
  fetchMasterEditionFromSeeds,
  TokenStandard,
  mplTokenMetadata,
  printV2,
  verifyCreatorV1,
} from "@metaplex-foundation/mpl-token-metadata";
import { assert } from "chai";
import { generateSigner, publicKey } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { mplToolbox } from "@metaplex-foundation/mpl-toolbox";
import {
  updatePlugin,
  fetchAsset,
  addPlugin,
} from "@metaplex-foundation/mpl-core";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
);

describe("jpegsfun_nft", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.jpegsfunNft as Program<JpegsfunNft>;

  console.log("Program ID:", program.programId.toBase58());
  console.log("Wallet:", provider.wallet.publicKey.toBase58());

  const [nftStatePDA, nftStateBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("nft-state")],
    program.programId
  );

  // const masterEditionMint = Keypair.generate();
  // const masterEditionMintPubkey = masterEditionMint.publicKey;
  // const masterEditionMintPubkey = new PublicKey(
  //   "3QC9byXaszTc1xL8W33tWG5QDwv6KLRVq2Af5n6ZNuev"
  // );
  // const nftMint = Keypair.generate();
  // const nftMintPubkey = nftMint.publicKey;

  const name = "jpegs.fun secret membership";
  const symbol = "JPEGS";
  const uri = `https://jpegs.fun/nft/metadata.json`;
  // const name = "Ronipepe secret membership";
  // const symbol = "rPEPEr";
  // const uri = `https://resources-test.jpegs.fun/metadata.json`;
  const totalSupply = 5000;
  /*
  it("Initializes the NFT collection", async () => {
    console.log("signer", provider.wallet.publicKey.toBase58());
    console.log("nftStatePDA", nftStatePDA.toBase58());
    console.log("masterEditionMintPubkey", masterEditionMintPubkey.toBase58());

    const instructionMethod = program.methods
      .initialize(new anchor.BN(totalSupply), nftStateBump, name, symbol, uri)
      .accounts({
        nftState: nftStatePDA,
        signer: provider.wallet.publicKey,
        mint: masterEditionMintPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      });

    const instruction = await instructionMethod.instruction();
    // console.log("Instruction:", instruction);
    const transaction = new anchor.web3.Transaction().add(instruction);
    // console.log("Transaction:", transaction);

    // 필요한 경우 최근 블록해시 가져오기
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    transaction.recentBlockhash = latestBlockhash.blockhash;
    transaction.feePayer = provider.wallet.publicKey;

    transaction.sign(masterEditionMint);
    await provider.wallet.signTransaction(transaction);

    // console.log("Signed Transaction:", transaction);

    // 트랜잭션 전송
    let signature;
    try {
      signature = await provider.connection.sendRawTransaction(
        transaction.serialize()
      );
      // console.log("Transaction signature:", signature);

      // 트랜잭션 확인
      const confirmation = await provider.connection.confirmTransaction(
        signature
      );
      // console.log("Transaction confirmation:", confirmation);
    } catch (error) {
      console.error("Error sending transaction:", error);
      // 트랜잭션 세부 정보 가져오기
      if (signature) {
        const txInfo = await provider.connection.getTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        console.log("Transaction details:", txInfo);
      }
    }

    // assert.ok(signature);

    // const nftState = await program.account.nftState.fetch(nftStatePDA);
    // assert.equal(nftState.name, name);
    // assert.equal(nftState.symbol, symbol);
    // assert.equal(nftState.uri, uri);
    // assert.ok(nftState.masterEditionMint.equals(masterEditionMintPubkey));
  });

  
  it("Creates the master edition", async () => {
    const [metadataAccount] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        masterEditionMintPubkey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [masterEditionAccount] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        masterEditionMintPubkey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const associatedTokenAccount = await getAssociatedTokenAddress(
      masterEditionMintPubkey,
      nftStatePDA,
      true
    );


    let tx;
    try {
      tx = await program.methods
        .createMasterEdition()
        .accounts({
          nftState: nftStatePDA,
          signer: provider.wallet.publicKey,
          mint: masterEditionMintPubkey,
          associatedTokenAccount: associatedTokenAccount,
          metadataAccount: metadataAccount,
          masterEditionAccount: masterEditionAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      
      console.log("Create Master Edition transaction signature:", tx);

      // Fetch and log transaction details
      const txInfo = await provider.connection.getTransaction(tx, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      console.log("Transaction details:", JSON.stringify(txInfo, null, 2));

    } catch (error) {
      console.error("Error creating master edition:", error);
      
      if (tx) {
        // If tx is defined, it means the transaction was submitted but failed
        const failedTxInfo = await provider.connection.getTransaction(tx, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });
        console.log("Failed transaction details:", JSON.stringify(failedTxInfo, null, 2));
      }
      
      throw error; // Re-throw the error to fail the test
    }
      

    console.log("Create Master Edition transaction signature:", tx);

    // Verify the master edition was created
    const tokenAccountInfo = await provider.connection.getTokenAccountBalance(
      associatedTokenAccount
    );
    assert.equal(tokenAccountInfo.value.uiAmount, 1);
  });
*/
  /*
  it("Mints a new NFT token and creates an edition", async () => {
    // Step 1: Mint NFT Token
    const [nftMint] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("edition"),
        masterEditionMintPubkey.toBuffer(),
        provider.wallet.publicKey.toBuffer(),
      ],
      program.programId
    );

    const tokenAccount = await getAssociatedTokenAddress(
      nftMint,
      provider.wallet.publicKey
    );

    try {
      console.log("nftMint", nftMint.toBase58());
      console.log("tokenAccount", tokenAccount.toBase58());

      const mintTokenSignature = await program.methods
        .mintNftToken()
        .accounts({
          payer: provider.wallet.publicKey,
          nftState: nftStatePDA,
          mint: nftMint,
          tokenAccount: tokenAccount,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log("Mint NFT Token transaction signature:", mintTokenSignature);
      if (mintTokenSignature) {
        const txInfo = await provider.connection.getTransaction(
          mintTokenSignature,
          {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
          }
        );
        console.log("Transaction details:", txInfo);
      }

      // Verify the NFT token was minted
      const tokenAccountInfo = await provider.connection.getTokenAccountBalance(
        tokenAccount
      );
      assert.equal(tokenAccountInfo.value.uiAmount, 1);

      // Step 2: Mint Edition
      const [metadataAccount] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [editionAccount] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          nftMint.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const [masterEditionAccount] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          masterEditionMintPubkey.toBuffer(),
          Buffer.from("edition"),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const nftState = await program.account.nftState.fetch(nftStatePDA);
      const editionNumber = nftState.editionCount.addn(1);

      const editionMarkerAccount = await getEditionMarkPda(
        masterEditionMintPubkey,
        editionNumber
      );

      const masterEditionTokenAccount = await getAssociatedTokenAddress(
        masterEditionMintPubkey,
        nftStatePDA,
        true
      );

      const [masterEditionMetadata] = await PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          masterEditionMintPubkey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      console.log("nftMint", nftMint.toBase58());
      console.log("metadataAccount", metadataAccount.toBase58());
      console.log("editionAccount", editionAccount.toBase58());
      console.log("masterEditionAccount", masterEditionAccount.toBase58());
      console.log("editionMarkerAccount", editionMarkerAccount.toBase58());
      console.log(
        "masterEditionTokenAccount",
        masterEditionTokenAccount.toBase58()
      );
      console.log("masterEditionMetadata", masterEditionMetadata.toBase58());
      console.log(
        "masterEditionMintPubkey",
        masterEditionMintPubkey.toBase58()
      );

      // const umi = createUmi("https://api.devnet.solana.com", "confirmed")
      //   .use(walletAdapterIdentity(provider.wallet))
      //   .use(mplTokenMetadata());
      // umi.programs.add(
      //   umi.programs.get(publicKey(TOKEN_METADATA_PROGRAM_ID.toBase58()))
      // );

      // const result = await printV1(umi, {
      //   masterTokenAccountOwner: umi.identity,
      //   masterEditionMint: publicKey(masterEditionMintPubkey.toBase58()),
      //   editionMint: publicKey(nftMint.toBase58()),
      //   editionTokenAccountOwner: publicKey(
      //     provider.wallet.publicKey.toBase58()
      //   ),
      //   editionMarkerPda: publicKey(editionMarkerAccount.toBase58()),
      //   editionNumber: nftState.editionCount.toNumber() + 1,
      //   tokenStandard: TokenStandard.NonFungible,
      // }).sendAndConfirm(umi);

      const mintEditionSignature = await program.methods
        .mintEdition()
        .accounts({
          payer: provider.wallet.publicKey,
          nftState: nftStatePDA,
          newMint: nftMint,
          tokenAccount: masterEditionTokenAccount,
          newMetadata: metadataAccount,
          newEdition: editionAccount,
          masterEdition: masterEditionAccount,
          editionMarker: editionMarkerAccount,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
          masterEditionMetadata: masterEditionMetadata,
          // authority: provider.wallet.publicKey,
        })
        .rpc();

      console.log("Mint Edition transaction signature:", mintEditionSignature);
      if (mintEditionSignature) {
        const txInfo = await provider.connection.getTransaction(
          mintEditionSignature,
          {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
          }
        );
        console.log("Transaction details:", txInfo);
      }

      // Verify the edition was created
      const editionAccountInfo = await provider.connection.getAccountInfo(
        editionAccount
      );
      assert.isNotNull(editionAccountInfo, "Edition account should exist");
    } catch (error) {
      console.error("Error minting NFT and creating edition:", error);
      throw error;
    }
  });
  */

  it("Debugging", async () => {
    const nftState = await program.account.nftState.fetch(nftStatePDA);
    console.log("nftState", nftState);
  });
/*
  it("Verifying", async () => {
    const umi = createUmi(
      "https://api.devnet.solana.com",
      // "https://solana-mainnet.g.allthatnode.com/full/json_rpc/8373468b042b4d8bbea29b3fe6a746ce",
      "confirmed"
    ).use(walletAdapterIdentity(provider.wallet));

    const metadata = publicKey("9QtPDtBkkuK1fPo2EJwA4RJZdfUqY7cQDu7pZF15PFZi");
    const result = await verifyCreatorV1(umi, {
      metadata,
      authority: umi.payer,
    }).sendAndConfirm(umi);

    console.log("result", result);
  });
*/
  async function getEditionMarkPda(
    masterEditionMint: PublicKey,
    editionNumber: anchor.BN
  ) {
    // const editionMarkerNumber = editionNumber.div(new anchor.BN(248));
    const EDITION_MARKER_BIT_SIZE = 248;
    let encodedEditionNumber = new anchor.BN(
      Math.floor(editionNumber.toNumber() / EDITION_MARKER_BIT_SIZE)
    );
    let editionNumberString = encodedEditionNumber.toString();
    console.log(
      "getEditionMarkPda() - editionNumber",
      editionNumber.toNumber()
    );
    console.log(
      "getEditionMarkPda() - editionNumberString",
      editionNumberString
    );
    return (
      await PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          masterEditionMint.toBuffer(),
          Buffer.from("edition"),
          Buffer.from(editionNumberString),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0];
  }
});
