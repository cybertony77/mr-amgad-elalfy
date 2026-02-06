import { useState } from 'react';
import { TextInput, PasswordInput } from '@mantine/core';
import classes from './FloatingLabelInput.module.css';

export function FloatingLabelInput({ label, value, onChange, type = 'text', ...props }) {
  const [focused, setFocused] = useState(false);
  const floating = value && value.trim().length !== 0 || focused || undefined;
  const InputComponent = type === 'password' ? PasswordInput : TextInput;

  return (
    <div className={classes.root}>
      <InputComponent
        {...props}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        classNames={{ input: classes.input }}
        data-floating={floating}
        autoComplete="off"
        placeholder=""
      />
      <label
        className={classes.label}
        data-floating={floating}
      >
        {label}
      </label>
    </div>
  );
} 