'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { answerQuestion, nextQuestion, startQuiz } from '@/lib/quiz-actions';
import type { QuizFeedback, QuizResult, QuizState } from '@/lib/quiz';
import QuizTopList from './QuizTopList';

// Ukens quiz, presentert som en vinetikett. Serveren eier tilstanden (hvilket
// spørsmål, tidsfrist, poeng); komponenten viser bare det serveren sender.

const SAVED_NAME_KEY = 'vinlotteri-navn'; // Samme nøkkel som kjøpsdialogen
const SECONDS_PER_QUESTION = 20; // Samme som i lib/quiz.ts (som ikke skal til klienten)

const seconds = (s: number) => s.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function QuizGame({
  roundName,
  initial,
  closed,
  nameSuggestions,
}: {
  roundName: string;
  initial: QuizState | null;
  closed: boolean;
  nameSuggestions: string[];
}) {
  const [state, setState] = useState<QuizState | null>(initial);
  const [feedback, setFeedback] = useState<QuizFeedback | null>(null);
  const [showResult, setShowResult] = useState(initial?.kind === 'done');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => ReturnType<typeof startQuiz>) =>
    startTransition(async () => {
      setError(null);
      const res = await action();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setState(res.state);
      setFeedback(res.feedback ?? null);
      if (res.state.kind === 'done' && !res.feedback) setShowResult(true);
    });

  const answer = (index: number, choice: number) => run(() => answerQuestion(index, choice));

  return (
    <div className="etikett rounded-sm wine-card-alpha px-5 py-7 sm:px-10 sm:py-9 text-center flex flex-col gap-6">
      <p className="font-serif italic wine-accent">{roundName}</p>

      {state === null ? (
        <StartView closed={closed} pending={pending} nameSuggestions={nameSuggestions} onStart={name => run(() => startQuiz(name))} />
      ) : showResult && state.kind === 'done' ? (
        <ResultView result={state.result} />
      ) : feedback ? (
        <FeedbackView
          feedback={feedback}
          pending={pending}
          last={state.kind === 'done'}
          onNext={() => (state.kind === 'done' ? setShowResult(true) : run(nextQuestion))}
        />
      ) : state.kind === 'question' ? (
        <QuestionView key={state.question.index} state={state} pending={pending} onAnswer={answer} />
      ) : state.kind === 'between' ? (
        <div className="flex flex-col items-center gap-4">
          <p className="wine-text-muted">
            Du har svart på {state.next} av {state.total} spørsmål. Klokka for neste spørsmål starter når du trykker.
          </p>
          <PrimaryButton pending={pending} onClick={() => run(nextQuestion)}>
            Neste spørsmål
          </PrimaryButton>
        </div>
      ) : null}

      {error && (
        <p role="alert" className="text-red-500 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function PrimaryButton({ pending, onClick, children, type = 'button' }: { pending: boolean; onClick?: () => void; children: React.ReactNode; type?: 'button' | 'submit' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={pending}
      className="wine-cta self-center inline-flex items-center gap-2 px-7 py-3 rounded-lg font-semibold disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
    >
      {pending && <Loader2 aria-hidden className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

function StartView({ closed, pending, nameSuggestions, onStart }: { closed: boolean; pending: boolean; nameSuggestions: string[]; onStart: (name: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Fyll inn navnet fra forrige loddkjøp på denne enheten (etter hydrering,
  // så server- og klient-HTML er like)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SAVED_NAME_KEY);
      if (saved && inputRef.current && !inputRef.current.value) inputRef.current.value = saved;
    } catch {
      // Lagring blokkert – da skriver man navnet selv
    }
  }, []);

  if (closed) {
    return (
      <p className="wine-text-muted max-w-[46ch] mx-auto">
        Quizen er stengt fordi salget er stengt for denne runden. En ny quiz kommer med neste runde.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-5 items-center"
      onSubmit={e => {
        e.preventDefault();
        onStart(String(new FormData(e.currentTarget).get('name') ?? ''));
      }}
    >
      <h2 className="font-serif text-3xl sm:text-4xl font-semibold wine-text text-balance">Fem spørsmål om vin</h2>
      <ul className="wine-text-muted text-[15px] leading-relaxed max-w-[44ch] text-left list-disc pl-5 space-y-1">
        <li>Du har {SECONDS_PER_QUESTION} sekunder på hvert spørsmål.</li>
        <li>Du kan bare prøve én gang per runde.</li>
        <li>Quizen er for dem som har kjøpt lodd denne uka. Bruk samme navn som på loddene.</li>
        <li>Svarene gir en klasse fra Bordeaux-klassifiseringen fra 1855, fra Premier Cru for fem riktige.</li>
      </ul>
      <div className="w-full max-w-xs text-left">
        <label htmlFor="quiz-name" className="block text-sm wine-text-muted mb-1">
          Navn
        </label>
        <input
          ref={inputRef}
          id="quiz-name"
          name="name"
          required
          minLength={2}
          maxLength={50}
          autoComplete="name"
          list={nameSuggestions.length ? 'quiz-ansatte' : undefined}
          placeholder="Skriv eller velg navnet ditt"
          className="w-full rounded-md border wine-border-strong wine-card-bg wine-text p-3 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
        />
        {nameSuggestions.length > 0 && (
          <datalist id="quiz-ansatte">
            {nameSuggestions.map(n => (
              <option key={n} value={n} />
            ))}
          </datalist>
        )}
      </div>
      <PrimaryButton type="submit" pending={pending}>
        Start quizen
      </PrimaryButton>
      <p className="text-xs wine-text-subtle">Klokka starter når du trykker.</p>
    </form>
  );
}

function Progress({ index, total }: { index: number; total: number }) {
  return (
    <p className="font-mono text-sm wine-text-subtle tabular-nums">
      Spørsmål {index + 1} av {total}
    </p>
  );
}

function QuestionView({
  state,
  pending,
  onAnswer,
}: {
  state: Extract<QuizState, { kind: 'question' }>;
  pending: boolean;
  onAnswer: (index: number, choice: number) => void;
}) {
  const { question } = state;
  const answered = useRef(false);
  const submit = (choice: number) => {
    if (answered.current) return;
    answered.current = true;
    onAnswer(question.index, choice);
  };

  // Tiden ute: send «ikke svart». Serveren sjekker fristen uansett.
  useEffect(() => {
    const t = setTimeout(() => submit(-1), question.secondsLeft * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fraction = question.secondsLeft / SECONDS_PER_QUESTION;

  return (
    <div className="flex flex-col gap-5">
      <Progress index={question.index} total={question.total} />
      <h2 className="font-serif text-2xl sm:text-[1.7rem] leading-snug font-semibold wine-text text-balance">{question.text}</h2>

      <div
        className="h-2 rounded-full overflow-hidden bg-[#722F37]/20"
        role="timer"
        aria-label={`${question.secondsLeft} sekunder igjen`}
      >
        <div
          className="quiz-timer h-full wine-burgundy-bg"
          style={{ '--quiz-from': fraction, animationDuration: `${question.secondsLeft}s` } as React.CSSProperties}
        />
      </div>

      <div className="grid gap-2.5 text-left">
        {question.options.map((o, i) => (
          <button
            key={o}
            type="button"
            disabled={pending}
            onClick={() => submit(i)}
            className="quiz-option flex items-baseline gap-3 rounded-md border px-4 py-3 wine-text disabled:opacity-60"
          >
            <span className="font-mono text-sm wine-accent">{'ABCD'[i]}</span>
            <span>{o}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FeedbackView({ feedback, pending, last, onNext }: { feedback: QuizFeedback; pending: boolean; last: boolean; onNext: () => void }) {
  const right = feedback.chosen === feedback.correct;
  return (
    <div className="flex flex-col gap-5">
      <Progress index={feedback.index} total={feedback.total} />
      <h2 className="font-serif text-2xl sm:text-[1.7rem] leading-snug font-semibold wine-text text-balance">{feedback.text}</h2>
      <div className="grid gap-2.5 text-left">
        {feedback.options.map((o, i) => (
          <div
            key={o}
            className={`flex items-baseline gap-3 rounded-md border px-4 py-3 ${
              i === feedback.correct ? 'quiz-right wine-text' : i === feedback.chosen ? 'quiz-wrong' : 'wine-border-faint wine-text-subtle'
            }`}
          >
            <span className="font-mono text-sm wine-accent">{'ABCD'[i]}</span>
            <span>{o}</span>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="font-serif text-xl wine-text">
        {right ? 'Riktig.' : feedback.chosen === -1 ? 'Tiden gikk ut.' : 'Feil svar.'}
      </p>
      <p className="text-left text-[15px] leading-relaxed wine-text-muted border-l-2 border-[#D4AF37] pl-4">{feedback.fact}</p>
      <PrimaryButton pending={pending} onClick={onNext}>
        {last ? 'Se klassifiseringen' : 'Neste spørsmål'}
      </PrimaryButton>
    </div>
  );
}

function ResultView({ result }: { result: QuizResult }) {
  const inTop = result.top.some(r => r.me);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 items-center">
        <p className="wine-text-muted">Din klassifisering</p>
        <h2 className="pop-in font-serif text-5xl sm:text-6xl font-semibold wine-accent text-balance">{result.className}</h2>
        <p className="wine-text-muted tabular-nums">
          {result.score} av {result.total} riktige på {seconds(result.seconds)} sekunder
        </p>
      </div>
      <p className="wine-text">
        Du er nummer {result.rank} av {result.participants} denne uka.
      </p>
      <QuizTopList
        rows={result.top}
        extra={inTop ? undefined : { rank: result.rank, name: 'Deg', score: result.score, className: result.className, seconds: result.seconds, me: true }}
      />
      <p className="text-sm wine-text-subtle">Ny quiz med nye spørsmål kommer med neste runde.</p>
    </div>
  );
}
