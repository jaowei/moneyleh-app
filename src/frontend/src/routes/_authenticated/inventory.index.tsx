import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import {
    type AllAccounts,
    type AllCards,
    fetchTagData,
    uiRouteClient
} from "../../lib/backend-clients.ts";
import { getBackendErrorResponse } from "../../lib/error.ts";
import { type ChangeEventHandler, useRef, useState } from "react";
import { AddButton } from "../../components/AddButton.tsx";
import AddTransactionsModal from "../../components/AddTransactionsModal.tsx";


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

        return {
            inventory,
            tagData,
        }
    }
})

type DataForAdding = { account?: AllAccounts[0]; card?: AllCards[0] }

const AllInventoryList = ({ allAccounts, allCards }: { allAccounts: AllAccounts, allCards: AllCards }) => {
    const { auth } = Route.useRouteContext()
    const router = useRouter()
    const addDialogRef = useRef<HTMLDialogElement>(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [nameForAdding, setNameForAdding] = useState<string | undefined>(undefined)
    const [dataForAdding, setDataForAdding] = useState<DataForAdding>({})
    const [addingError, setAddingError] = useState('')

    const filteredAccounts = allAccounts.filter((acc) => {
        const hasAccount = acc.accounts
        const isUserAccount = !!acc.user_accounts
        const targetSearchName = `${acc.companies?.name.toLowerCase()} ${acc.accounts?.name.toLowerCase()}`
        const matchSearchTerm = searchTerm ? targetSearchName.includes(searchTerm) : true
        return (hasAccount && !isUserAccount) && matchSearchTerm
    }
    )
    const filteredCards = allCards.filter((card) => {
        const hasCard = card.cards
        const isUserCard = !!card.user_cards
        const targetSearchName = `${card.companies?.name.toLowerCase()} ${card.cards?.name.toLowerCase()}`
        const matchSearchTerm = searchTerm ? targetSearchName.includes(searchTerm) : true
        return (hasCard && !isUserCard) && matchSearchTerm
    })

    const handleAccountSearchInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setSearchTerm(e.target.value.toLowerCase())
    }

    const handleAddAccountOrCardClick = (data: DataForAdding) => {
        addDialogRef.current?.showModal()
        setDataForAdding(data)
    }

    const handleAddInModalClick = async () => {
        const userId = auth?.user?.id
        if (!userId) throw new Error('No user id')
        const { account, card } = dataForAdding

        if (!account && !card) return

        const res = await uiRouteClient.assignTo[":userId"].$post({
            param: { userId },
            json: {
                ...(account?.accounts && {
                    accountData: [{
                        accountId: account.accounts.id,
                        ...(nameForAdding && { accountLabel: nameForAdding }),
                        userId,
                    }]
                }),
                ...(card?.cards && {
                    cardData: [{
                        cardId: card.cards.id,
                        ...(nameForAdding && { cardLabel: nameForAdding }),
                        userId
                    }]
                }),
            }
        })
        if (res.ok) {
            addDialogRef.current?.close()
            router.invalidate()
        } else {
            setAddingError(res.statusText)
        }
    }

    const handleNameForAddingInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setNameForAdding(e.target.value)
    }

    const handleAddModalClose = () => {
        setDataForAdding({})
        setNameForAdding('')
        addDialogRef.current?.close()
    }

    return (
        <div className="flex flex-col gap-2">
            <input className="input" placeholder="search accounts" onChange={handleAccountSearchInputChange} />
            <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
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
                                    <AddButton onClick={() => handleAddAccountOrCardClick({ account: acc })} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
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
                                    <AddButton onClick={() => handleAddAccountOrCardClick({ card })} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <dialog ref={addDialogRef} className="modal">
                    <div className="modal-box">
                        <fieldset className="fieldset">
                            <input type="text" className="input"
                                placeholder="Enter a name for your account"
                                value={nameForAdding} onChange={handleNameForAddingInputChange} />
                            <label className="label">Optional name to add, e.g. shopping account</label>
                            {addingError && (<div className="alert alert-error">{addingError}</div>)}
                        </fieldset>
                        <div className="modal-action">
                            <button className="btn" onClick={handleAddInModalClick}>Add</button>
                            <button className="btn" onClick={handleAddModalClose}>Close</button>
                        </div>
                    </div>
                </dialog>
            </div>
        </div>
    )
}

function InventoryComponent() {
    const { inventory, tagData } = Route.useLoaderData()

    return (
        <div className="flex flex-col items-center p-4">
            <div className="w-4/5">
                <div className="collapse collapse-arrow bg-base-200 mb-4">
                    <input type="checkbox" />
                    <div className="collapse-title">
                        Add accounts/cards
                    </div>
                    <div className="collapse-content">
                        <AllInventoryList allAccounts={inventory.allAccounts} allCards={inventory.allCards} />
                    </div>
                </div>
                <div className="rounded-box border border-base-content/5 bg-base-100">
                    <table className="table">
                        <thead className="bg-base-200"><tr><th colSpan={4} align="center">Accounts</th></tr></thead>
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
                                    <td>{acc.companies.name}</td>
                                    <td>{acc.accounts?.name}</td>
                                    <td >{acc.user_accounts?.accountLabel}</td>
                                    <td>
                                        {acc.accounts?.id && <Link to='/inventory/account/$accountId' params={{
                                            accountId: `${acc.accounts.id}`
                                        }}>Go to</Link>}
                                        <AddTransactionsModal accountId={acc.accounts?.id} tagData={tagData} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <thead className="bg-base-200"><tr><th colSpan={4} align="center">Cards</th></tr></thead>
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
                                    <td>{card.companies.name}</td>
                                    <td>{card.cards?.name}</td>
                                    <td>{card.user_cards?.cardLabel}</td>
                                    <td>
                                        <AddTransactionsModal cardId={card.cards?.id} tagData={tagData} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}