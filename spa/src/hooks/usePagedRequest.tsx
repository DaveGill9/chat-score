import { useState, useEffect, useRef, useCallback } from "react";
import apiClient from "../services/api-client";
import { toast } from "../services/toast-service";
import { addSearchParams } from "../utils/add-search-params";

export type PagedRequestOptions = {
    limit?: number;
    reverseOrder?: boolean;
}

const usePagedRequest = <T,>(url: string, options?: PagedRequestOptions) => {
    
    const [offset, setOffset] = useState(0);
    const [data, setData] = useState<T[] | undefined>(undefined);
    const isLoadingRef = useRef(false);
    const [loading, _setLoading] = useState(false);
    const setLoading = (loading: boolean) => {
        isLoadingRef.current = loading;
        _setLoading(loading);
    }

    const [hasMore, setHasMore] = useState(true);
    const [hash, setHash] = useState(0);
    const limit = options?.limit || 50;
    const reverseOrder = options?.reverseOrder || false;

    const loadMore = () => setOffset(prev => prev + limit);
    
    const reset = () => {
        setData(undefined);
        setOffset(0);
        setHasMore(true);
        setHash(prev => prev + 1);
    };

    const fetchData = useCallback(async () => {
        if (isLoadingRef.current || !hasMore) return;

        const _url = addSearchParams(url, { 
            offset: offset.toString(),
            limit: limit.toString()
        });

        setLoading(true);
        try {
            const { data } = await apiClient.get(_url);
            const results = data as T[];
            if (offset === 0) {
                setData(results);
            } else if (reverseOrder) {
                setData(prev => prev ? [...results, ...prev] : results);
            } else {
                setData(prev => prev ? [...prev, ...results] : results);
            }
            setHasMore(results.length === limit);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Error fetching data: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    }, [url, offset, hasMore, limit, reverseOrder]);

    useEffect(() => { reset() }, [url]);

    useEffect(() => {
        if (url) {
            fetchData();
        }
    }, [offset, hash, url, fetchData]);

    return { data, setData, loading, reset, hasMore, loadMore };
};

export default usePagedRequest;