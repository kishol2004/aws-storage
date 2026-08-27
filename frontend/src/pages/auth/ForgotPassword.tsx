import React, { useState } from 'react';
import { Mail, ArrowLeft } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Reset Password</h1>
          <p className="text-sm text-muted-foreground">We will send you link instructions to recovery your credentials</p>
        </div>

        {submitted ? (
          <div className="mt-6 text-center space-y-4">
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 text-sm text-primary">
              If an account matches {email}, a recovery link has been sent.
            </div>
            <a href="/login" className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Sign In
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground" htmlFor="email">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-border bg-accent/30 py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none"
            >
              Send Reset Link
            </button>

            <div className="text-center mt-4">
              <a href="/login" className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to Sign In
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
