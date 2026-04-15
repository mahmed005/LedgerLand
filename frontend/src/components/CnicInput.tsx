/* CnicInput — Auto-formatted CNIC input (XXXXX-XXXXXXX-X) */

import { useCallback, type ChangeEvent } from "react";

interface Props {
  value: string;
  onChange: (raw: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

/** Format raw digits into XXXXX-XXXXXXX-X */
function formatCnic(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export default function CnicInput({
  value,
  onChange,
  id = "cnic",
  placeholder = "XXXXX-XXXXXXX-X",
  required = false,
  disabled = false,
}: Props) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, "").slice(0, 13);
      onChange(raw);
    },
    [onChange]
  );

  return (
    <input
      type="text"
      id={id}
      className="form-input"
      value={formatCnic(value)}
      onChange={handleChange}
      placeholder={placeholder}
      maxLength={15}
      required={required}
      disabled={disabled}
      autoComplete="off"
    />
  );
}
