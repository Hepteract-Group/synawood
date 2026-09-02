/** User-facing lines that name the active Product (ADR-0068 tenancy). */

export const studioEmptyStateLine = (productName: string | null): string =>
  productName
    ? `Start a cut for ${productName}. You’ll chat the edit, preview the timeline, then export when it’s ready.`
    : 'Create or join a Product first, then start a cut.'

export const newProjectLandsIn = (productName: string | null): string =>
  productName ? `This project will be created in ${productName}.` : 'Select a Product first.'

export const brandDnaLede = (productName: string | null): string =>
  productName
    ? `Brand DNA is ${productName}’s copy: who it is for, the offer, and what ads may claim. Catalog is a list of offers, not the Media bin.`
    : 'Brand DNA is this organization’s copy: who it is for, the offer, and what ads may claim. Catalog is a list of offers, not the Media bin.'

export const workspaceOwnedBy = (productName: string | null): string =>
  productName ? `In ${productName}` : ''
