"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";

interface ValidationMetrics {
  wordCount: number;
  mechanicCount: number;
  screenCount: number;
  estimatedDevTime: 'simple' | 'medium' | 'complex';
  simplicityScore: number;
}

interface ValidationIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'complexity' | 'scope' | 'technical' | 'smart';
  message: string;
  suggestion: string;
}

interface SpecValidationBadgeProps {
  documentType: 'one-page' | 'gdd';
  content: string;
  title: string;
  onValidationChange?: (isValid: boolean, score: number) => void;
  compact?: boolean;
}

export default function SpecValidationBadge({
  documentType,
  content,
  title,
  onValidationChange,
  compact = false
}: SpecValidationBadgeProps) {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const validateContent = async () => {
      if (!content || content.length < 50) {
        setIsValid(null);
        setScore(null);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/spec/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentType, content, title })
        });

        if (response.ok) {
          const data = await response.json();
          setIsValid(data.valid);
          setScore(data.score);
          setMetrics(data.metrics);
          setIssues(data.issues || []);
          
          if (onValidationChange) {
            onValidationChange(data.valid, data.score);
          }
        }
      } catch (error) {
        console.error('Validation error:', error);
      } finally {
        setLoading(false);
      }
    };

    // Délai pour éviter trop de requêtes
    const timeoutId = setTimeout(validateContent, 1000);
    return () => clearTimeout(timeoutId);
  }, [content, documentType, title, onValidationChange]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm">
        <div className="w-3 h-3 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
        Validation...
      </div>
    );
  }

  if (isValid === null || score === null) {
    return null;
  }

  const getStatusColor = () => {
    if (score >= 80) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (score >= 60) return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    return "bg-rose-500/20 text-rose-300 border-rose-500/30";
  };

  const getStatusIcon = () => {
    if (score >= 80) return <CheckCircle className="w-4 h-4" />;
    if (score >= 60) return <AlertTriangle className="w-4 h-4" />;
    return <XCircle className="w-4 h-4" />;
  };

  const getStatusText = () => {
    if (score >= 80) return "Simple";
    if (score >= 60) return "Moyen";
    return "Trop complexe";
  };

  if (compact) {
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${getStatusColor()} text-sm font-medium hover:opacity-80 transition-opacity`}
        title={`Score de simplicité: ${score}/100 - Cliquez pour les détails`}
      >
        {getStatusIcon()}
        {getStatusText()} ({score}/100)
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border ${getStatusColor()} text-left hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <div>
            <div className="font-semibold">Validation: {getStatusText()}</div>
            <div className="text-sm opacity-80">Score de simplicité: {score}/100</div>
          </div>
        </div>
        <div className="text-sm opacity-60">
          {showDetails ? "Masquer" : "Afficher les détails"}
        </div>
      </button>

      {showDetails && (
        <div className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
          {metrics && (
            <div>
              <h4 className="font-semibold text-white/90 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Métriques
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="text-white/60">Mots</div>
                  <div className="font-medium">{metrics.wordCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white/60">Mécaniques</div>
                  <div className="font-medium">{metrics.mechanicCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white/60">Écrans</div>
                  <div className="font-medium">{metrics.screenCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-white/60">Dev estimé</div>
                  <div className="font-medium">{metrics.estimatedDevTime}</div>
                </div>
              </div>
            </div>
          )}

          {issues.length > 0 && (
            <div>
              <h4 className="font-semibold text-white/90 mb-2">Problèmes détectés</h4>
              <div className="space-y-2">
                {issues.map((issue, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg text-sm ${
                      issue.severity === 'critical'
                        ? 'bg-rose-500/10 border border-rose-500/20'
                        : issue.severity === 'warning'
                        ? 'bg-amber-500/10 border border-amber-500/20'
                        : 'bg-blue-500/10 border border-blue-500/20'
                    }`}
                  >
                    <div className="font-medium mb-1">{issue.message}</div>
                    <div className="opacity-80">{issue.suggestion}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-white/10">
            <div className="text-sm text-white/60">
              <strong>Conseil :</strong> Gardez votre jeu simple comme 2048, Tetris ou Pong.
              Maximum 3 mécaniques principales, sessions de 15 minutes max.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}