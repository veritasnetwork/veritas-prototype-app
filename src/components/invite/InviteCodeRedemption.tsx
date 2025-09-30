'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function InviteCodeRedemption() {
  const { getAccessToken } = usePrivy();
  const [inviteCode, setInviteCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRedeeming(true);
    setMessage('');

    try {
      const jwt = await getAccessToken();
      if (!jwt) {
        setMessage('Please log in first');
        setIsRedeeming(false);
        return;
      }

      const response = await fetch('/api/supabase/functions/v1/app-invite-codes-redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ code: inviteCode.toUpperCase() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Success! ${data.bonus_granted ? `You received $${data.bonus_granted} bonus stake!` : ''}`);
        setInviteCode('');
        setTimeout(() => {
          setShowForm(false);
          setMessage('');
        }, 3000);
      } else {
        setMessage(data.error || 'Failed to redeem code');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="text-[#B9D9EB] hover:text-[#F0EAD6] text-sm font-mono transition-colors"
      >
        Have an invite code?
      </button>
    );
  }

  return (
    <div className="bg-black border border-[#F0EAD6] rounded p-4 font-mono">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-[#F0EAD6] font-medium">REDEEM INVITE CODE</h3>
        <button
          onClick={() => {
            setShowForm(false);
            setMessage('');
            setInviteCode('');
          }}
          className="text-[#F0EAD6] hover:text-[#B9D9EB] text-lg"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleRedeem} className="space-y-4">
        <input
          type="text"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="ENTER CODE"
          className="w-full bg-transparent border border-[#F0EAD6] text-[#F0EAD6] px-3 py-2 rounded placeholder-[#F0EAD6] placeholder-opacity-50 focus:outline-none focus:border-[#B9D9EB] uppercase"
          disabled={isRedeeming}
          required
        />

        <button
          type="submit"
          disabled={isRedeeming || !inviteCode.trim()}
          className="w-full bg-[#B9D9EB] hover:bg-[#0C1D51] text-[#0C1D51] hover:text-[#B9D9EB] border border-[#0C1D51] hover:border-[#B9D9EB] py-2 rounded transition-all disabled:opacity-50"
        >
          {isRedeeming ? 'REDEEMING...' : 'REDEEM'}
        </button>
      </form>

      {message && (
        <p className={`text-sm mt-3 ${message.includes('Success') || message.includes('received') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      <p className="text-[#F0EAD6] text-xs mt-4 opacity-70">
        Invite codes grant bonus stake and special perks
      </p>
    </div>
  );
}