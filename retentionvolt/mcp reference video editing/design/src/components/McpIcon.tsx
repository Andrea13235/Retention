import React from 'react';

interface McpIconProps {
  className?: string;
  size?: number;
}

/**
 * Exact Mobbin MCP / Code Icon component (CodeIcon.tsx from Mobbin production build).
 * Vector path with viewBox="0 0 20 20" and fill="currentColor".
 */
export const McpIcon: React.FC<McpIconProps> = ({ className = 'w-4 h-4', size }) => {
  return (
    <svg
      width={size || 20}
      height={size || 20}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7.40527 4.84375L6.78125 5.625L3.28125 10L6.78125 14.375L7.40527 15.1562L5.84375 16.4053L5.21875 15.625L1.21875 10.625L0.719727 10L1.21875 9.375L5.21875 4.375L5.84375 3.59473L7.40527 4.84375ZM14.7812 4.375L18.7812 9.375L19.2803 10L18.7812 10.625L14.7812 15.625L14.1562 16.4053L12.5947 15.1562L13.2188 14.375L16.7188 10L13.2188 5.625L12.5947 4.84375L14.1562 3.59473L14.7812 4.375Z"
        fill="currentColor"
      />
    </svg>
  );
};
