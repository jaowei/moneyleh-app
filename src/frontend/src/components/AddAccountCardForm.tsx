import type React from "react"
import { accountTypes, cardNetworks, cardTypes } from "../../../db/schema";
import { backendRouteClient, type GetCompanyRes, type PostAccountReq, type PostCardReq } from "../lib/backend-clients";
import { useState } from "react";
import { Form, Field } from 'react-final-form'
import type { FormApi } from "final-form";

interface FormProps {
    companies: GetCompanyRes["data"];
    userId: string;
    onFormSubmitSucess: () => void;
}

const AddForm = ({ title, children, isOpen, onCollapseClick }: {
    title: string;
    children: React.ReactNode;
    isOpen: boolean;
    onCollapseClick: () => void;
}) => {
    const handleCollpaseClick = () => {
        onCollapseClick()
    }

    return (
        <div className={`collapse collapse-arrow ${isOpen ? 'collapse-open' : 'collapse-close'}`}>
            <input type="checkbox" onClick={handleCollpaseClick} />
            <div className="collapse-title font-semibold after:start-5 after:end-auto pe-4 ps-12">{title}</div>
            <div className="collapse-content text-sm">
                {children}
            </div>
        </div>
    )
}

const CompanyPicker = ({ companies }: Pick<FormProps, 'companies'>) => {
    const defaultValue = "Pick a company"
    return (
        <>
            <label className="label">Company</label>
            <Field<string> defaultValue={defaultValue} name="companyId" component="select" className="select">
                <option disabled={true}>{defaultValue}</option>
                {companies.map((company) => (
                    <option value={company.id}>{company.name}</option>
                ))}
            </Field>
        </>
    )
}

const ErrorDisplay = ({ error }: { error: string }) => {
    return (
        <div className="alert alert-error">
            <span>{error}</span>
        </div>
    )
}

export const AddAccountForm = ({ companies, userId, onFormSubmitSucess }: FormProps) => {
    const [error, setError] = useState('')
    const [openCollapse, setOpenCollapse] = useState(false)

    const onSubmit = async (values: PostAccountReq, form: FormApi<PostAccountReq>) => {
        setError('')
        const { accountType, name, companyId } = values

        if (!accountType || !name || !companyId) {
            setError('Please fill in all fields')
            return
        }

        const createRes = await backendRouteClient.api.account[":userId"].$post({
            json: {
                accountType,
                name,
                companyId
            },
            param: {
                userId
            }
        })

        if (!createRes.ok) {
            setError(await createRes.text())
        } else {
            form.reset()
            setOpenCollapse(false)
            onFormSubmitSucess()
        }
    }
    return (
        <AddForm title="Create a new account" isOpen={openCollapse} onCollapseClick={() => { setOpenCollapse((p) => !p) }}>
            <Form
                onSubmit={onSubmit}
                render={({ handleSubmit }) => (
                    <form onSubmit={handleSubmit}>
                        <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
                            <legend className="fieldset-legend">New account details</legend>

                            <CompanyPicker companies={companies} />

                            <label className="label">Account name</label>
                            <Field<string> name="name" component="input" type="text" className="input" placeholder="enter account name" />

                            <label className="label">Account Type</label>
                            <Field<string> name="accountType" component="select" defaultValue="Pick an account type" className="select">
                                <option disabled={true}>Pick an account type</option>
                                {accountTypes.map((type) => (
                                    <option value={type}>{type}</option>
                                ))}
                            </Field>
                            <button className="btn btn-neutral mt-4" type="submit">create</button>
                        </fieldset>
                        {error && (<ErrorDisplay error={error} />)}
                    </form>
                )}
            />
        </AddForm>
    )
}

export const AddCardForm = ({ companies, userId, onFormSubmitSucess }: FormProps) => {
    const [error, setError] = useState('')
    const [openCollapse, setOpenCollapse] = useState(false)

    const onSubmit = async (values: PostCardReq, form: FormApi<PostCardReq>) => {
        setError('')
        const { cardNetwork, name, companyId, cardType } = values

        if (!cardNetwork || !name || !companyId || !cardType) {
            setError('Please fill in all fields')
            return
        }

        const createRes = await backendRouteClient.api.card[":userId"].$post({
            json: {
                cardType,
                name,
                companyId,
                cardNetwork
            },
            param: {
                userId
            }
        })

        if (!createRes.ok) {
            setError(await createRes.text())
        } else {
            form.reset()
            setOpenCollapse(false)
            onFormSubmitSucess()
        }
    }
    return (
        <AddForm title="add new card" isOpen={openCollapse} onCollapseClick={() => { setOpenCollapse((p) => !p) }}>
            <Form
                onSubmit={onSubmit}
                render={({ handleSubmit }) => (
                    <form onSubmit={handleSubmit}>
                        <fieldset className="fieldset bg-base-200 border-base-300 rounded-box w-xs border p-4">
                            <legend className="fieldset-legend">New card details</legend>

                            <CompanyPicker companies={companies} />

                            <label className="label">Card name</label>
                            <Field<string> name="name" component="input" type="text" className="input" placeholder="enter card name" />

                            <label className="label">Card Type</label>
                            <Field<string> name="cardType" component="select" defaultValue="Pick a card type" className="select">
                                <option disabled={true}>Pick a card type</option>
                                {cardTypes.map((type) => (
                                    <option>{type}</option>
                                ))}
                            </Field>

                            <label className="label">Card Network</label>
                            <Field<string> name="cardNetwork" component="select" defaultValue="Pick a card network" className="select">
                                <option disabled={true}>Pick a card network</option>
                                {cardNetworks.map((type) => (
                                    <option>{type}</option>
                                ))}
                            </Field>
                            <button className="btn btn-neutral mt-4" type="submit">create</button>
                        </fieldset>
                        {error && (<ErrorDisplay error={error} />)}
                    </form>
                )}
            />
        </AddForm>
    )
}