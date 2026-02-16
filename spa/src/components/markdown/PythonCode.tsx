import { useState } from 'react';
import styles from './PythonCode.module.scss';
import Icon from '../icon/Icon';
import IconButton from '../icon/IconButton';

export default function PythonCode({ code }: { code: string }) {

    const [showCode, setShowCode] = useState(false);

    return (
        <div className={styles.code}>
            <strong className={showCode ? styles.headerOpen : styles.headerClosed}>
                <Icon name="terminal" />
                <span>Python Code</span>
                <IconButton icon={ showCode ? 'expand_less' : 'expand_more' } onClick={() => setShowCode(!showCode)} />
            </strong>
            {showCode && (
                <pre>
                    {code}
                </pre>
            )}
        </div>
    );
}