import type {
    ColumnDefinition
} from "../hooks/useColumnPreferences";


type ColumnMenuProps<T extends string> = {
    columns: ColumnDefinition<T>[];
    visibleColumns: T[];
    isColumnVisible: (columnId: T) => boolean;
    toggleColumn: (columnId: T) => void;
};


function ColumnMenu<T extends string>({
    columns,
    visibleColumns,
    isColumnVisible,
    toggleColumn
}: ColumnMenuProps<T>) {

    return (
        <details className="column-menu">
            <summary>
                Colonnes
                <span>{visibleColumns.length}/{columns.length}</span>
            </summary>
            <div>
                {columns.map(
                    column => (
                        <label key={column.id}>
                            <input
                                type="checkbox"
                                checked={isColumnVisible(column.id)}
                                onChange={
                                    () =>
                                        toggleColumn(column.id)
                                }
                            />
                            {column.label}
                        </label>
                    )
                )}
            </div>
        </details>
    );

}


export default ColumnMenu;
