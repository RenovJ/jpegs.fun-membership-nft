use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3, update_metadata_accounts_v2,
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata, UpdateMetadataAccountsV2,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};
use mpl_token_metadata::accounts::{MasterEdition, Metadata as MetadataAccount};
use mpl_token_metadata::instructions::{
    MintNewEditionFromMasterEditionViaTokenCpiBuilder,
};
use mpl_token_metadata::types::{Creator, DataV2};

declare_id!("JPEG1hyU9AKdNmUtiFpU6csNSH6D93rdisH5zUEkEPS");

#[program]
pub mod jpegsfun_nft {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        total_supply: u64,
        bump: u8,
        name: String,
        symbol: String,
        uri: String,
    ) -> Result<()> {
        require!(name.len() <= 32, ErrorCode::NameTooLong);
        require!(symbol.len() <= 7, ErrorCode::SymbolTooLong);
        require!(uri.len() <= 200, ErrorCode::UriTooLong);
        // let name = "jpegs.fun Secret Society".to_string();
        // let symbol = "JPEGS".to_string();
        // let uri = "https://jpegs.fun/nft/metadata.json";

        let nft_state = &mut ctx.accounts.nft_state;
        if nft_state.is_initialized {
            require!(
                ctx.accounts.signer.key() == nft_state.admin,
                ErrorCode::InvalidAuthority
            );
        } else {
            nft_state.admin = ctx.accounts.signer.key();
            nft_state.is_initialized = true;
        }
        nft_state.authority = ctx.accounts.signer.key();
        nft_state.master_edition_mint = ctx.accounts.mint.key();
        nft_state.total_supply = total_supply;
        nft_state.bump = bump;
        nft_state.name = name;
        nft_state.symbol = symbol;
        nft_state.uri = uri;

        Ok(())
    }

    pub fn create_master_edition(ctx: Context<CreateMasterEdition>) -> Result<()> {
        let name = ctx.accounts.nft_state.name.clone();
        let symbol = ctx.accounts.nft_state.symbol.clone();
        let uri = ctx.accounts.nft_state.uri.clone();
        let nft_state = &mut ctx.accounts.nft_state;

        require!(
            ctx.accounts.signer.key() == nft_state.admin,
            ErrorCode::InvalidAuthority
        );

        msg!("Minting token");
        let seeds = &[b"nft-state".as_ref(), &[nft_state.bump]];
        let signer = &[&seeds[..]];
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.associated_token_account.to_account_info(),
                authority: nft_state.to_account_info(),
            },
            signer,
        );
        mint_to(cpi_context, 1)?;

        msg!("Creating metadata account with uri: {}", uri.clone());
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMetadataAccountsV3 {
                metadata: ctx.accounts.metadata_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                mint_authority: nft_state.to_account_info(),
                update_authority: nft_state.to_account_info(),
                payer: ctx.accounts.signer.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer,
        );
        let data_v2 = DataV2 {
            name,
            symbol,
            uri,
            seller_fee_basis_points: 0,
            creators: Some(vec![Creator {
                address: ctx.accounts.signer.key(),
                verified: false,
                share: 100,
            }]),
            collection: None,
            uses: None,
        };
        create_metadata_accounts_v3(cpi_context, data_v2, true, true, None)?;

        msg!("Creating master edition account");
        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            CreateMasterEditionV3 {
                edition: ctx.accounts.master_edition_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                update_authority: nft_state.to_account_info(),
                mint_authority: nft_state.to_account_info(),
                payer: ctx.accounts.signer.to_account_info(),
                metadata: ctx.accounts.metadata_account.to_account_info(),
                token_program: ctx.accounts.token_program.to_account_info(),
                system_program: ctx.accounts.system_program.to_account_info(),
                rent: ctx.accounts.rent.to_account_info(),
            },
            signer,
        );
        create_master_edition_v3(cpi_context, None)?;
        nft_state.edition_count = 0;

        msg!("Master edition created");
        Ok(())
    }

    pub fn mint_nft_token(ctx: Context<MintNftToken>) -> Result<()> {
        let seeds = &[b"nft-state".as_ref(), &[ctx.accounts.nft_state.bump]];
        let signer = &[&seeds[..]];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.token_account.to_account_info(),
                authority: ctx.accounts.nft_state.to_account_info(),
            },
            signer,
        );
        mint_to(cpi_context, 1)?;

        Ok(())
    }

    pub fn mint_edition(ctx: Context<MintEdition>) -> Result<()> {
        let nft_state = &mut ctx.accounts.nft_state;

        require!(
            nft_state.edition_count < nft_state.total_supply,
            ErrorCode::EditionLimitReached
        );
        nft_state.edition_count += 1;
        let edition_number = nft_state.edition_count;

        let seeds = &[b"nft-state".as_ref(), &[ctx.accounts.nft_state.bump]];
        let signer = &[&seeds[..]];

        let mut cpi_builder = MintNewEditionFromMasterEditionViaTokenCpiBuilder::new(
            &ctx.accounts.token_metadata_program,
        );

        cpi_builder
            .new_metadata(&ctx.accounts.new_metadata)
            .new_edition(&ctx.accounts.new_edition)
            .master_edition(&ctx.accounts.master_edition)
            .new_mint(&ctx.accounts.new_mint.to_account_info())
            .edition_mark_pda(&ctx.accounts.edition_marker)
            .new_mint_authority(&ctx.accounts.nft_state.to_account_info())
            .payer(&ctx.accounts.payer)
            .token_account_owner(&ctx.accounts.nft_state.to_account_info())
            .token_account(&ctx.accounts.token_account.to_account_info())
            .new_metadata_update_authority(&ctx.accounts.nft_state.to_account_info())
            .metadata(&ctx.accounts.master_edition_metadata)
            .token_program(&ctx.accounts.token_program)
            .system_program(&ctx.accounts.system_program)
            .rent(Some(&ctx.accounts.rent.to_account_info()))
            .mint_new_edition_from_master_edition_via_token_args(
                mpl_token_metadata::types::MintNewEditionFromMasterEditionViaTokenArgs {
                    edition: edition_number,
                },
            ).invoke_signed(signer)?;
        msg!("edition number: {}", edition_number);

        Ok(())
    }
    pub fn update_metadata(ctx: Context<UpdateMetadata>) -> Result<()> {
        let name = ctx.accounts.nft_state.name.clone();
        let symbol = ctx.accounts.nft_state.symbol.clone();
        let uri = ctx.accounts.nft_state.uri.clone();

        let seeds = &[b"nft-state".as_ref(), &[ctx.accounts.nft_state.bump]];
        let signer = &[&seeds[..]];

        let cpi_accounts = UpdateMetadataAccountsV2 {
            metadata: ctx.accounts.metadata_account.to_account_info(),
            update_authority: ctx.accounts.nft_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_metadata_program.to_account_info();
        let data = DataV2 {
            name: name.clone(),
            symbol: symbol.clone(),
            uri: uri.clone(),
            seller_fee_basis_points: 0,
            creators: Some(vec![Creator {
                address: ctx.accounts.signer.key(),
                verified: false,
                share: 100,
            }]),
            collection: None,
            uses: None,
        };

        let cpi_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        let _ = update_metadata_accounts_v2(
            cpi_context,
            Some(ctx.accounts.nft_state.key()),
            Some(data),
            Some(false),
            Some(true),
        );

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        space = 395,
        seeds = [b"nft-state"],
        bump
    )]
    pub nft_state: Account<'info, NftState>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        init_if_needed,
        payer = signer,
        mint::decimals = 0,
        mint::authority = nft_state,
        mint::freeze_authority = nft_state,
    )]
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateMasterEdition<'info> {
    #[account(
        mut,
        seeds = [b"nft-state"],
        bump = nft_state.bump,
    )]
    pub nft_state: Account<'info, NftState>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = nft_state
    )]
    pub associated_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        address=MetadataAccount::find_pda(&mint.key()).0,
    )]
    /// CHECK: We're about to create this account
    pub metadata_account: AccountInfo<'info>,
    #[account(
        mut,
        address=MasterEdition::find_pda(&mint.key()).0,
    )]
    /// CHECK: We're about to create this account
    pub master_edition_account: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintNftToken<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"nft-state"],
        bump = nft_state.bump
    )]
    pub nft_state: Account<'info, NftState>,
    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = nft_state,
        mint::freeze_authority = nft_state,
        seeds = [b"edition", nft_state.master_edition_mint.key().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer
    )]
    pub token_account: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct MintEdition<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"nft-state"],
        bump = nft_state.bump
    )]
    pub nft_state: Account<'info, NftState>,
    #[account(
        mut,
        mint::decimals = 0,
        mint::authority = nft_state,
        mint::freeze_authority = nft_state,
        seeds = [b"edition", nft_state.master_edition_mint.key().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub new_mint: Account<'info, Mint>,
    #[account(
        mut,
        associated_token::mint = nft_state.master_edition_mint,
        associated_token::authority = nft_state
    )]
    pub token_account: Account<'info, TokenAccount>,
    /// CHECK: We're about to create this account
    #[account(
        mut,
        address=MetadataAccount::find_pda(&new_mint.key()).0,
    )]
    pub new_metadata: AccountInfo<'info>,
    /// CHECK: We're about to create this account
    #[account(
        mut,
        address=MasterEdition::find_pda(&new_mint.key()).0,
    )]
    pub new_edition: AccountInfo<'info>,
    /// CHECK: We are passing in this account ourselves
    #[account(
        mut,
        address=MasterEdition::find_pda(&nft_state.master_edition_mint.key()).0,
    )]
    pub master_edition: AccountInfo<'info>,
    /// CHECK: We're about to create this account
    #[account(mut)]
    pub edition_marker: AccountInfo<'info>,
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    /// CHECK: We are passing in this account ourselves
    pub token_metadata_program: AccountInfo<'info>,
    /// CHECK: We are passing in this account ourselves
    pub master_edition_metadata: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct UpdateMetadata<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"nft-state"],
        bump = nft_state.bump
    )]
    pub nft_state: Account<'info, NftState>,
    #[account(
        mut,
        address=MetadataAccount::find_pda(&nft_state.master_edition_mint).0,
    )]
    /// CHECK: We're about to update this account
    pub metadata_account: AccountInfo<'info>,
    pub token_metadata_program: Program<'info, Metadata>,
}

#[account]
pub struct NftState {
    pub authority: Pubkey,
    pub master_edition_mint: Pubkey,
    pub edition_count: u64,
    pub total_supply: u64,
    pub bump: u8,
    pub is_initialized: bool,
    pub admin: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid authority")]
    InvalidAuthority,
    #[msg("Edition limit reached")]
    EditionLimitReached,
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Symbol too long")]
    SymbolTooLong,
    #[msg("URI too long")]
    UriTooLong,
}
