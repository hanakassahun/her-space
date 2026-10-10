import { forwardRef } from "react";

type UserTextProps = {
  text: string;
  className?: string;
};

const UserText = forwardRef<HTMLParagraphElement, UserTextProps>(function UserText({ text, className = "" }, ref) {
  const containsEthiopic = /[\u1200-\u137F]/.test(text);

  return (
    <p
      ref={ref}
      lang={containsEthiopic ? "am" : "en"}
      className={`user-text break-words whitespace-pre-wrap ${containsEthiopic ? "user-text-am" : "user-text-en"} ${className}`}
    >
      {text}
    </p>
  );
});

export default UserText;