import { Observable, useMemoizedObservable, useObservable } from "micro-observables";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Page } from "./page";
import { MappedStore } from "./stores/mappedStore";
import { PaginatedStore } from "./stores/paginatedStore";
import { Store } from "./stores/store";

export interface AsyncResult<T> {
	result: T | null;
	loading: boolean;
	error: Error | null;
}
export interface PaginatedDataResult<T, Args extends unknown[]> {
	fetch: (...args: Args) => Promise<void>;
	fetchMore: () => Promise<void>;
	moreLoading: boolean;
	lastPage: boolean;
	error: Error | null;
	loading: boolean;
	result: readonly T[];
	totalPages?: number;
	totalSize?: number;
}

export function useStore<T extends { id: string }>(id: string, store: Store<T>, deps: unknown[]): AsyncResult<T> {
	const result = useMemoizedObservable(() => store.getObservable(id), [id]);

	const [loading, setLoading] = useState(!result);
	const [error, setError] = useState(null);

	useEffect(() => {
		setLoading(true);
		store
			.fetch(id)
			.catch((e) => setError(e))
			.finally(() => setLoading(false));
	}, [id, ...deps]);

	return { result, loading, error };
}

export function usePaginatedStore<T, Args extends unknown[]>(
	paginatedStore: PaginatedStore<T, Args, any, any>,
	deps: unknown[],
	...args: Args
): PaginatedDataResult<T, Args> {
	const loading = useObservable(paginatedStore.fetching);
	const moreLoading = useObservable(paginatedStore.fetchingMore);
	return {
		loading,
		moreLoading,
		...useObservablePaginatedData(
			paginatedStore.paginatedItems,
			() => paginatedStore.list(...args),
			() => paginatedStore.listMore(...args),
			[...deps, ...args]
		),
	};
}

export function useMappedStore<T, S extends string, Args extends unknown[]>(
	id: S,
	mappedStore: MappedStore<T, S, Args, any, any>,
	deps: unknown[],
	...args: Args
): PaginatedDataResult<T, Args> {
	const loading = useMemoizedObservable(() => mappedStore.getFetching(id), [id]);
	const moreLoading = useMemoizedObservable(() => mappedStore.getFetchingMore(id), [id]);
	return {
		loading,
		moreLoading,
		...useObservablePaginatedData(
			mappedStore.getObservableItems(id),
			() => mappedStore.list(id, ...args),
			() => mappedStore.listMore(id, ...args),
			[id, ...deps]
		),
	};
}

export function useObservablePaginatedData<T>(
	observableData: Observable<Page<T> | null>,
	fetch: () => Promise<void>,
	fetchMoreData: () => Promise<void>,
	deps: unknown[]
) {
	const [error, setError] = useState(null);

	useEffect(() => {
		fetch().catch((e) => setError(e));
	}, [...deps]);

	const data = useMemoizedObservable(() => observableData, deps);

	const result = data?.content ?? [];
	const totalPages = data?.totalPages;
	const totalSize = data?.totalSize;
	const lastPage = totalPages !== undefined && data !== null && data.page >= totalPages;

	const fetchMore = useCallback(async () => {
		if (!totalPages || !data || lastPage) {
			return;
		}
		await fetchMoreData();
	}, [totalPages, data, ...deps]);

	return {
		result,
		error,
		totalPages,
		totalSize,
		lastPage,
		fetch,
		fetchMore,
	};
}
