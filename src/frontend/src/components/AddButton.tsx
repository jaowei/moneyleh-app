export const AddIcon = () =>
    <span className="icon-[material-symbols--add-2-rounded]"></span>

export const AddButton = ({onClick}: { onClick: () => void; }) => {
    return (
        <button className="btn btn-circle" onClick={onClick}>
            <span className="icon-[material-symbols--add-2-rounded]"></span>
        </button>
    )
}