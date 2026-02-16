export const classList = (...classes: (string | undefined)[]) => {
    return classes.filter(Boolean).join(' ');
};