import {
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import {
    fetchUserPreference,
    saveUserPreference
} from "../utils/userPreferencesApi";


export type ColumnDefinition<T extends string> = {
    id: T;
    label: string;
};


export function useColumnPreferences<T extends string>(
    preferenceKey: string,
    columns: ColumnDefinition<T>[]
) {

    const defaultColumnIds = useMemo(
        () =>
            columns.map(
                column =>
                    column.id
            ),
        [
            columns
        ]
    );
    const allowedColumnIds = useMemo(
        () =>
            new Set(defaultColumnIds),
        [
            defaultColumnIds
        ]
    );
    const [visibleColumns, setVisibleColumns] = useState<T[]>(defaultColumnIds);
    const hasLoadedPreference = useRef(false);

    useEffect(
        () => {
            hasLoadedPreference.current = false;
            fetchUserPreference<T[]>(preferenceKey)
                .then(
                    savedColumns => {
                        if (!Array.isArray(savedColumns)) {
                            setVisibleColumns(defaultColumnIds);
                            return;
                        }

                        const nextColumns = savedColumns.filter(
                            column =>
                                allowedColumnIds.has(column)
                        );

                        setVisibleColumns(
                            nextColumns.length > 0 ?
                                nextColumns :
                                defaultColumnIds
                        );
                    }
                )
                .catch(
                    () =>
                        setVisibleColumns(defaultColumnIds)
                )
                .finally(
                    () => {
                        hasLoadedPreference.current = true;
                    }
                );
        },
        [
            allowedColumnIds,
            defaultColumnIds,
            preferenceKey
        ]
    );

    useEffect(
        () => {
            if (!hasLoadedPreference.current)
                return;

            saveUserPreference(
                preferenceKey,
                visibleColumns
            ).catch(
                () => undefined
            );
        },
        [
            preferenceKey,
            visibleColumns
        ]
    );

    function isColumnVisible(
        columnId: T
    ) {

        return visibleColumns.includes(columnId);

    }

    function toggleColumn(
        columnId: T
    ) {

        setVisibleColumns(
            currentColumns =>
                currentColumns.includes(columnId) ?
                    currentColumns.filter(
                        currentColumn =>
                            currentColumn !== columnId
                    ) :
                    [
                        ...currentColumns,
                        columnId
                    ]
        );

    }

    return {
        visibleColumns,
        isColumnVisible,
        toggleColumn
    };

}
