export const addSearchParams = (path: string, params: Record<string, string>) => {
    const [basePath, existingQuery] = path.split('?');
    const searchParams = new URLSearchParams(existingQuery);
    
    Object.entries(params).forEach(([key, value]) => {
        if (value === '') {
            searchParams.delete(key);
        } else {
            searchParams.set(key, value);
        }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
};