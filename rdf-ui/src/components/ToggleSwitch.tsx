"use client";

type ToggleSwitchProps = {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export default function ToggleSwitch({ checked, disabled = false, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      aria-label="Toggle AI mode"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 shadow-inner transition-all duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-green-500 shadow-green-950/20" : "bg-gray-700 shadow-black/30"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

