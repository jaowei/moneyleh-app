import {createFileRoute, useRouter} from "@tanstack/react-router";
import {type AllAccounts, type AllCards, uiRouteClient} from "../../lib/backend-clients.ts";
import {getBackendErrorResponse} from "../../lib/error.ts";
import {type ChangeEventHandler, type ReactNode, useRef, useState} from "react";
import {AddButton, AddIcon} from "../../components/AddButton.tsx";
import AddTransactionsModal from "../../components/AddTransactionsModal.tsx";


export const Route = createFileRoute('/_authenticated/inventory')({
    component: InventoryComponent,
    loader: async ({context: {auth}}) => {
        const userId = auth?.user?.id
        if (!userId) throw new Error()
        let inventory
        const allInventoryRes = await uiRouteClient.availableInventory[':userId'].$get({
            param: {userId}
        })
        if (allInventoryRes.ok) {
            inventory = (await allInventoryRes.json())
        } else {
            throw await getBackendErrorResponse(allInventoryRes)
        }
        return {
            inventory
        }
    }
})

const CurrentInventoryDisplayList = ({type, show, children}: {
    type: 'Cards' | 'Accounts';
    show: boolean;
    children: ReactNode
}) => {
    return (
        <div className="flex flex-col w-full items-center gap-2">
            <h2 className="text-4xl">My {type}</h2>
            <div className="card bg-base-200 rounded-box grid place-items-center min-h-20 h-full w-full p-4">
                {show ? (
                    <ul className="list bg-base-100 w-full">
                        {children}
                    </ul>
                ) : `No ${type}`}
            </div>
        </div>
    )
}

type DataForAdding = { account?: AllAccounts[0]; card?: AllCards[0] }

const AllInventoryList = ({allAccounts, allCards}: { allAccounts: AllAccounts, allCards: AllCards }) => {
    const {auth} = Route.useRouteContext()
    const router = useRouter()
    const addDialogRef = useRef<HTMLDialogElement>(null)
    const [accountSearchTerm, setAccountSearchTerm] = useState('')
    const [cardSearchTerm, setCardSearchTerm] = useState('')
    const [nameForAdding, setNameForAdding] = useState<string | undefined>(undefined)
    const [dataForAdding, setDataForAdding] = useState<DataForAdding>({})
    const [addingError, setAddingError] = useState('')

    const filteredAccounts = allAccounts.filter((acc) => {
            const hasAccount = acc.accounts
            const isUserAccount = !!acc.user_accounts
            const targetSearchName = `${acc.companies?.name.toLowerCase()} ${acc.accounts?.name.toLowerCase()}`
            const matchSearchTerm = accountSearchTerm ? targetSearchName.includes(accountSearchTerm) : true
            return (hasAccount && !isUserAccount) && matchSearchTerm
        }
    )
    const filteredCards = allCards.filter((card) => {
        const hasCard = card.cards
        const isUserCard = !!card.user_cards
        const targetSearchName = `${card.companies?.name.toLowerCase()} ${card.cards?.name.toLowerCase()}`
        const matchSearchTerm = cardSearchTerm ? targetSearchName.includes(cardSearchTerm) : true
        return (hasCard && !isUserCard) && matchSearchTerm
    })

    const handleAccountSearchInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setAccountSearchTerm(e.target.value.toLowerCase())
    }

    const handleCardSearchInputChange: ChangeEventHandler<HTMLInputElement> = (e) => {
        setCardSearchTerm(e.target.value.toLowerCase())
    }

    const handleAddAccountOrCardClick = (data: DataForAdding) => {
        addDialogRef.current?.showModal()
        setDataForAdding(data)
    }

    const handleAddInModalClick = async () => {
        const userId = auth?.user?.id
        if (!userId) throw new Error('No user id')
        const {account, card} = dataForAdding

        if (!account && !card) return

        const res = await uiRouteClient.assignTo[":userId"].$post({
            param: {userId},
            json: {
                ...(account?.accounts && {
                    accountData: [{
                        accountId: account.accounts.id,
                        ...(nameForAdding && {accountLabel: nameForAdding}),
                        userId,
                    }]
                }),
                ...(card?.cards && {
                    cardData: [{
                        cardId: card.cards.id,
                        ...(nameForAdding && {cardLabel: nameForAdding}),
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
        <div className="flex flex-col gap-2 p-2 is-drawer-close:hidden">
            <div className="collapse collapse-arrow bg-base-100">
                <input type="checkbox"/>
                <div className="collapse-title">
                    Available Accounts
                </div>
                <div className="collapse-content">
                    <input className="input" placeholder="search accounts" onChange={handleAccountSearchInputChange}/>
                    <ul className="list w-full grow">
                        {filteredAccounts.map((acc) => {
                            return <li className="list-row is-drawer-close:hidden">
                                <div>{acc.companies?.name}</div>
                                <div>{acc.accounts?.name}</div>
                                <AddButton onClick={() => handleAddAccountOrCardClick({account: acc})}/>
                            </li>
                        })}
                    </ul>
                </div>
            </div>
            <div className="collapse collapse-arrow bg-base-100">
                <input type="checkbox"/>
                <div className="collapse-title">
                    Available Cards
                </div>
                <div className="collapse-content">
                    <input className="input" placeholder="search cards" onChange={handleCardSearchInputChange}/>
                    <ul className="list w-full grow is-drawer-close:hidden">
                        {filteredCards.map((card) => {
                            return <li className="list-row is-drawer-close:hidden">
                                <div>{card.companies?.name}</div>
                                <div>{card.cards?.name}</div>
                                <AddButton onClick={() => handleAddAccountOrCardClick({card})}/>
                            </li>
                        })}
                    </ul>
                </div>
            </div>
            <dialog ref={addDialogRef} className="modal">
                <div className="modal-box">
                    <fieldset className="fieldset">
                        <input type="text" className="input"
                               placeholder="Enter a name for your account"
                               value={nameForAdding} onChange={handleNameForAddingInputChange}/>
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
    )
}

function InventoryComponent() {
    const {inventory} = Route.useLoaderData()

    return <div>
        <div className="drawer drawer-open">
            <input id="my-drawer-1" type="checkbox" className="drawer-toggle"/>
            <div className="drawer-content">
                <label htmlFor="my-drawer-1" className="btn btn-circle">
                    <AddIcon/>
                </label>
                <div className="flex flex-col items-center w-full gap-4">
                    <div className="w-4/5">
                        <CurrentInventoryDisplayList type='Accounts' show={!!inventory.userAccounts.length}>
                            {inventory.userAccounts.map((acc) => (
                                <li className="list-row">
                                    <div>{acc.companies.name}</div>
                                    <div>{acc.accounts?.name}</div>
                                    <div className="list-col-grow">{acc.user_accounts?.accountLabel}</div>
                                    <AddTransactionsModal accountId={acc.accounts?.id}/>
                                </li>
                            ))}
                        </CurrentInventoryDisplayList>
                        <div className="divider"></div>
                        <CurrentInventoryDisplayList type='Cards' show={!!inventory.userCards.length}>
                            {inventory.userCards.map((card) => (
                                <li className="list-row">
                                    <div>{card.companies.name}</div>
                                    <div>{card.cards?.name}</div>
                                    <div className="list-col-grow">{card.user_cards?.cardLabel}</div>
                                    <AddTransactionsModal cardId={card.cards?.id}/>
                                </li>
                            ))}
                        </CurrentInventoryDisplayList>
                    </div>
                </div>
            </div>
            <div className="drawer-side">
                <label htmlFor="my-drawer-1" aria-label="close sidebar" className="drawer-overlay">
                </label>
                <div
                    className="bg-base-200 min-h-full overflow-y-scroll is-drawer-close:w-0 is-drawer-open:w-80">
                    <AllInventoryList allAccounts={inventory.allAccounts} allCards={inventory.allCards}/>
                </div>
            </div>
        </div>
    </div>
}