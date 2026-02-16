import styles from './Icon.module.scss';

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string; 
}

const Icon = ({ name, ...props }: IconProps) => {
    
  const classList = [styles.icon, props.className].filter(Boolean).join(' ');

  return (
    <i className={classList} aria-hidden="true" {...props}>
      {name}
    </i>
  );
};

export default Icon;

