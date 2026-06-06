'use client';

import { useState } from 'react';

export function CopyInviteLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button className="btn-secondary whitespace-nowrap" type="button" onClick={handleCopy}>
      {copied ? 'Copiado' : 'Copiar link'}
    </button>
  );
}
