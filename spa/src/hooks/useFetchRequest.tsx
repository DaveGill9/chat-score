import { useState, useEffect, useCallback, useRef } from "react";
import apiClient from "../services/api-client";
import { toast } from "../services/toast-service";

const useFetchRequest = <T,>(url: string) => {

    const [data, setData] = useState<T | undefined>(undefined);
    
    const isLoadingRef = useRef(false);
    const [loading, _setLoading] = useState(false);
    const setLoading = (loading: boolean) => {
        isLoadingRef.current = loading;
        _setLoading(loading);
    }

    const fetchData = useCallback(async () => {
        if (isLoadingRef.current) return;
        setLoading(true);
        try {
            const { data } = await apiClient.get(url);
            setData(data as T);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Error fetching data: ${errorMessage}`);
        } finally {
            setLoading(false);
        }
    }, [url]);    

    useEffect(() => {        
        if (url)
            fetchData();
    }, [url, fetchData]);

    return { data, setData, loading };
};

export default useFetchRequest;