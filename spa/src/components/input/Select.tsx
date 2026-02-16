import { useCallback, useEffect, useState } from "react";
import Button from "../button/Button";
import Icon from "../icon/Icon";
import styles from "./Select.module.scss";
import Popover from "../popover/Popover";
import Loading from "../feedback/Loading";
import apiClient from "../../services/api-client";
import { toast } from "../../services/toast-service";

export interface SelectOption {
    label: string;
    value: string;
}

interface SelectProps {
    placeholder?: string;
    value: string;
    onChange?: (value: string) => void;
    options: SelectOption[] | string[] | string;
}

export default function Select({ placeholder = 'Select...', value, onChange, options }: SelectProps) {

    const [values, setValues] = useState<SelectOption[]>([]);
    const [working, setWorking] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [visible, setVisible] = useState(false);

    const fetchValues = useCallback(async () => {
        setWorking(true);
        apiClient.get(`/select/${options}`).then(response => {
            setValues(response.data);
        }).catch(error => {
            toast.error(error);
        }).finally(() => {
            setWorking(false);
        });
    }, [options]);

    useEffect(() => {
        if (typeof options === 'string') {
            setValues([{ label: options, value: options }]);
        } else if (Array.isArray(options)) {
            const optionsArray = options as string[];
            setValues(optionsArray.map(option => ({ label: option, value: option })));
        } else {
            fetchValues();
        }
    }, [options, fetchValues]);

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowDown') {
            setSelectedIndex(selectedIndex === null ? 0 : (selectedIndex + 1) % values.length);
            event.preventDefault();
            event.stopPropagation();
        } else if (event.key === 'ArrowUp') {
            setSelectedIndex(selectedIndex === null ? values.length - 1 : (selectedIndex - 1 + values.length) % values.length);
            event.preventDefault();
            event.stopPropagation();
        } else if (event.key === 'Enter') {
            onChange?.(values[selectedIndex ?? 0].value);
            event.preventDefault();
            event.stopPropagation();
            setVisible(false);
        } else if (event.key === 'Escape') {
            setSelectedIndex(null);
            event.preventDefault();
            event.stopPropagation();
            setVisible(false);
        }
    };

    const setValue = (value: string) => {
        onChange?.(value);
        setVisible(false);
        setSelectedIndex(null);
    }

    const menu = (
        <>
            {values.map((option: SelectOption, index: number) => (
                <Button 
                    type="block" 
                    key={index} 
                    onClick={() => setValue(option.value)} 
                    className={selectedIndex === index ? styles.selected : ''}>
                    {option.label}
                </Button>
            ))}
        </>
    );

    return (
        <Popover
            menu={menu}
            position="bottom"
            visible={visible}
            setVisible={setVisible}
            width="auto"
            className={styles.selectMenu}>
            <Button type="block" className={styles.select} onKeyDown={handleKeyDown} onBlur={() => setVisible(false)}>
                <span>{value || placeholder}</span>
                {!working && !value && <Icon name="expand_all" />}
                {!working && value && <Icon name="close" onClick={e => { e.stopPropagation(); onChange?.(''); setSelectedIndex(null); }} />}
                {working && <Loading size="small" />}
            </Button>
        </Popover>
    )
}