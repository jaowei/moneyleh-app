import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
    type AllAccounts,
    type AllCards,
    fetchCompanies,
    fetchTagData,
    type GetCompanyRes,
    uiRouteClient
} from "../../lib/backend-clients.ts";
import { getBackendErrorResponse } from "../../lib/error.ts";
import { type ChangeEventHandler, useRef, useState } from "react";
import { AddButton } from "../../components/AddButton.tsx";
import BulkUploadModal from "../../components/BulkUploadModal.tsx";
import { AddAccountForm, AddCardForm } from "../../components/AddAccountCardForm.tsx";
import { ModalCloseButton } from "../../components/ModalCloseButton.tsx";


export const Route = createFileRoute('/_authenticated/inventory/')({
    component: InventoryComponent,
    loader: async ({ context: { auth } }) => {
        const userId = auth?.user?.id

        if (!userId) throw new Error()

        let inventory

        const allInventoryRes = await uiRouteClient.availableInventory[':userId'].$get({
            param: { userId }
        })
        if (allInventoryRes.ok) {
            inventory = (await allInventoryRes.json())
        } else {
            throw await getBackendErrorResponse(allInventoryRes)
        }

        const tagData = await fetchTagData()
        const companyData = await fetchCompanies()

        return {
            inventory,
            tagData,
            companyData
        }
    }
})

const AllListModalBox = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="modal-box max-w-[80vw]">
            {children}
        </div>
    )
}

const AllAccountsList = ({ allAccounts, companyData }: { allAccounts: AllAccounts; companyData: GetCompanyRes["data"] }) => {
    const { auth } = Route.useRouteContext()
    const userId = auth?.user?.id
    if (!userId) throw new Error('No user id')

    const router = useRouter()

    const accountsListDialogRef = useRef<HTMLDialogElement>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [addingError, setAddingError] = useState('')

    const filteredAccounts = allAccounts.filter((acc) => {
        const hasAccount = acc.accounts
        const isUserAccount = !!acc.user_accounts
        const targetSearchName = `${acc.companies?.name.toLowerCase()} ${acc.accounts?.name.toLowerCase()}`
        const matchSearchTerm = searchTerm ? targetSearchName.includes(searchTerm) : true
        return (hasAccount && !isUserAccount) && matchSearchTerm
    })

    const handleAccountSearchInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setSearchTerm(e.target.value.toLowerCase())
    }
    const handleAddAccountClick = async (account: AllAccounts[0]) => {
        if (!account.accounts) return

        const res = await uiRouteClient.assignTo[":userId"].$post({
            param: { userId },
            json: {
                accountData: [{
                    accountId: account.accounts.id,
                    userId,
                }]
            }
        })
        if (res.ok) {
            accountsListDialogRef.current?.close()
            router.invalidate()
        } else {
            setAddingError(res.statusText)
        }
    }
    const handleModalClose = () => {
        accountsListDialogRef.current?.close()
    }
    const handleFormSuccess = () => {
        router.invalidate()
    }

    return (
        <>
            <button className="btn btn-sm btn-accent" onClick={() => accountsListDialogRef.current?.showModal()}>Add accounts</button>
            <dialog ref={accountsListDialogRef} className="modal">
                <AllListModalBox>
                    <ModalCloseButton />
                    <input className="input" placeholder="search accounts" onChange={handleAccountSearchInputChange} />
                    <AddAccountForm companies={companyData} userId={userId} onFormSubmitSucess={handleFormSuccess} />
                    <table className="table">
                        <thead><tr><th colSpan={3} align="center">Accounts</th></tr></thead>
                        <thead>
                            <tr>
                                <th>Company name</th>
                                <th>Account name</th>
                                <th>Add</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAccounts.map((acc) => (
                                <tr>
                                    <td>{acc.companies.name}</td>
                                    <td>{acc.accounts?.name}</td>
                                    <td>
                                        <AddButton onClick={() => handleAddAccountClick(acc)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {addingError && <div className="alert alert-error">{addingError}</div>}
                    <div className="modal-action">
                        <button className="btn" onClick={handleModalClose}>Close</button>
                    </div>
                </AllListModalBox>
            </dialog>
        </>
    )
}

const AllCardsList = ({ allCards, companyData }: { allCards: AllCards; companyData: GetCompanyRes["data"] }) => {
    const { auth } = Route.useRouteContext()
    const router = useRouter()

    const userId = auth?.user?.id
    if (!userId) throw new Error('No user id')

    const cardsListDialogRef = useRef<HTMLDialogElement>(null)

    const [searchTerm, setSearchTerm] = useState('')
    const [addingError, setAddingError] = useState('')

    const filteredCards = allCards.filter((card) => {
        const hasCard = card.cards
        const isUserCard = !!card.user_cards
        const targetSearchName = `${card.companies?.name.toLowerCase()} ${card.cards?.name.toLowerCase()}`
        const matchSearchTerm = searchTerm ? targetSearchName.includes(searchTerm) : true
        return (hasCard && !isUserCard) && matchSearchTerm
    })

    const handleCardSearchInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setSearchTerm(e.target.value.toLowerCase())
    }

    const handleAddCardClick = async (card: AllCards[0]) => {
        if (!card.cards) return

        const res = await uiRouteClient.assignTo[":userId"].$post({
            param: { userId },
            json: {
                cardData: [{
                    cardId: card.cards.id,
                    userId
                }]
            }
        })
        if (res.ok) {
            cardsListDialogRef.current?.close()
            router.invalidate()
        } else {
            setAddingError(res.statusText)
        }
    }

    const handleAddModalClose = () => {
        cardsListDialogRef.current?.close()
    }
    const handleFormSuccess = () => {
        router.invalidate()
    }


    return (
        <div className="flex flex-col gap-2">
            <button className="btn btn-sm btn-accent" onClick={() => cardsListDialogRef.current?.showModal()}>Add cards</button>
            <dialog ref={cardsListDialogRef} className="modal">
                <AllListModalBox>
                    <ModalCloseButton />
                    <input className="input" placeholder="search cards" onChange={handleCardSearchInputChange} />
                    <AddCardForm companies={companyData} userId={userId} onFormSubmitSucess={handleFormSuccess} />
                    <table className="table">
                        <thead><tr><th colSpan={3} align="center">Cards</th></tr></thead>
                        <thead>
                            <tr>
                                <th>Company name</th>
                                <th>Card name</th>
                                <th>Add</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCards.map((card) => (
                                <tr>
                                    <td>{card.companies.name}</td>
                                    <td>{card.cards?.name}</td>
                                    <td>
                                        <AddButton onClick={() => handleAddCardClick(card)} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {addingError && (<div className="alert alert-error">{addingError}</div>)}
                    <div className="modal-action">
                        <button className="btn" onClick={handleAddModalClose}>Close</button>
                    </div>
                </AllListModalBox>
            </dialog>
        </div>
    )
}

const TableRow = ({ children }: { children: any }) => {
    return (
        <td className="overflow-y-auto">{children}</td>
    )
}

function InventoryComponent() {
    const { inventory, tagData, companyData } = Route.useLoaderData()

    return (
        <div className="flex flex-col items-center p-4">
            <div className="w-4/5">
                <div className="rounded-box border border-base-content/5 bg-base-100">
                    <table className="table table-fixed">
                        <thead className="bg-base-200">
                            <tr>
                                <th colSpan={4} align="center">
                                    <div className="flex flex-row justify-between items-center">
                                        <h2 className="font-bold">Accounts</h2>
                                        <AllAccountsList allAccounts={inventory.allAccounts} companyData={companyData} />
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <thead>
                            <tr>
                                <th>Company name</th>
                                <th>Account name</th>
                                <th>Label</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventory.userAccounts.map((acc) => (
                                <tr>
                                    <TableRow>{acc.companies.name}</TableRow>
                                    <TableRow>{acc.accounts?.name}</TableRow>
                                    <TableRow>{acc.user_accounts?.accountLabel}</TableRow>
                                    <TableRow>
                                        <div className="flex flex-row gap-1">
                                            {acc.accounts?.id && (
                                                <button className="btn btn-xs btn-primary">
                                                    <Link to='/inventory/account/$accountId' params={{
                                                        accountId: `${acc.accounts.id}`
                                                    }}>View</Link>
                                                </button>
                                            )}
                                            <BulkUploadModal accountId={acc.accounts?.id} tagData={tagData} />
                                        </div>
                                    </TableRow>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <table className="table table-fixed">
                        <thead className="bg-base-200"><tr><th colSpan={4} align="center">
                            <div className="flex flex-row justify-between items-center">
                                <h2 className="font-bold">Cards</h2>
                                <AllCardsList allCards={inventory.allCards} companyData={companyData} />
                            </div>
                        </th></tr></thead>
                        <thead>
                            <tr>
                                <th>Company name</th>
                                <th>Card name</th>
                                <th>Label</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventory.userCards.map((card) => (
                                <tr>
                                    <TableRow>{card.companies.name}</TableRow>
                                    <TableRow>{card.cards?.name}</TableRow>
                                    <TableRow>{card.user_cards?.cardLabel}</TableRow>
                                    <TableRow>
                                        <div className="flex flex-row gap-1">
                                            {card.cards?.id && (
                                                <button className="btn btn-xs btn-primary">
                                                    <Link to='/inventory/card/$cardId' params={{
                                                        cardId: `${card.cards.id}`
                                                    }}>View</Link>
                                                </button>
                                            )}
                                            <BulkUploadModal cardId={card.cards?.id} tagData={tagData} />
                                        </div>
                                    </TableRow>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}