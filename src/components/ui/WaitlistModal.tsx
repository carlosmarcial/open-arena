'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '@/lib/theme';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setEmail('');
        // Auto-close after 2 seconds
        setTimeout(() => {
          onClose();
          setMessage(null);
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Something went wrong' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to connect. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Use conditional classes based on the actual theme state
  const modalStyles = {
    backdrop: isDark 
      ? "absolute inset-0 bg-black/70 backdrop-blur-sm"
      : "absolute inset-0 bg-black/20 backdrop-blur-sm",
    container: isDark
      ? "relative w-full max-w-md rounded-xl bg-[#1a1d23] border border-gray-800 p-6 shadow-2xl"
      : "relative w-full max-w-md rounded-xl bg-[#f6f4ef] border border-[#e5e2da] p-6 shadow-2xl",
    closeButton: isDark
      ? "absolute top-4 right-4 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
      : "absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer",
    title: isDark
      ? "text-2xl font-bold text-white mb-2"
      : "text-2xl font-bold text-gray-900 mb-2",
    subtitle: isDark
      ? "text-gray-400 text-sm"
      : "text-gray-700 text-sm",
    label: isDark
      ? "block text-sm font-medium text-gray-300 mb-2"
      : "block text-sm font-medium text-gray-800 mb-2",
    input: isDark
      ? "w-full px-4 py-2.5 bg-[#23272f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors"
      : "w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors",
    button: isDark
      ? "w-full py-2.5 px-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
      : "w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed cursor-pointer text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]",
    successMessage: isDark
      ? "bg-green-900/20 text-green-400 border border-green-800"
      : "bg-green-50 text-green-700 border border-green-200",
    errorMessage: isDark
      ? "bg-red-900/20 text-red-400 border border-red-800"
      : "bg-red-50 text-red-700 border border-red-200"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className={modalStyles.backdrop}
        onClick={onClose}
      />

      {/* Modal */}
      <div className={modalStyles.container}>
        {/* Close button */}
        <button
          onClick={onClose}
          className={modalStyles.closeButton}
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2 className={modalStyles.title}>
            Join the Waitlist
          </h2>
          <p className={modalStyles.subtitle}>
            Get early access to new features.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="email" 
              className={modalStyles.label}
            >
              Email Address
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className={modalStyles.input}
            />
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-3 rounded-lg text-sm ${
                message.type === 'success'
                  ? modalStyles.successMessage
                  : modalStyles.errorMessage
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || !email}
            className={modalStyles.button}
          >
            {isSubmitting ? 'Joining...' : 'Join Waitlist'}
          </button>
        </form>
      </div>
    </div>
  );
}
