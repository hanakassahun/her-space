import { forwardRef } from "react";
import Link from "next/link";
import { splitMentions } from "@/lib/mentions";

type UserTextProps = {
  text: string;
  className?: string;
  mentions?: string[];
};

const UserText = forwardRef<HTMLParagraphElement, UserTextProps>(function UserText({ text, className = "", mentions }, ref) {
  const containsEthiopic = /[\u1200-\u137F]/.test(text);
  const content = mentions === undefined
    ? text
    : splitMentions(text, mentions).map((segment, index) => segment.type === "mention"
      ? <Link key={index} href={`/u/${segment.value.slice(1).toLowerCase()}`} className="font-medium text-[#7755A5]">{segment.value}</Link>
      : segment.value);

  return (
    <p
      ref={ref}
      lang={containsEthiopic ? "am" : "en"}
      className={`user-text break-words whitespace-pre-wrap ${containsEthiopic ? "user-text-am" : "user-text-en"} ${className}`}
    >
      {content}
    </p>
  );
});

export default UserText;