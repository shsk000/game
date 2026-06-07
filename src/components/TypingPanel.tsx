type Props = {
  hiragana: string;
  completed: string;
  remained: string;
  hint?: string;
};

export const TypingPanel = ({ hiragana, completed, remained, hint }: Props) => {
  return (
    <div className="typing-panel">
      {hint && <div className="typing-hint">{hint}</div>}
      <div className="typing-hiragana">{hiragana}</div>
      <div className="typing-romaji">
        <span className="typing-completed">{completed}</span>
        <span className="typing-remained">{remained}</span>
      </div>
    </div>
  );
};
