type FriendlyErrorMessageProps = {
  message: string;
};

export default function FriendlyErrorMessage({ message }: FriendlyErrorMessageProps) {
  const referenceMarker = "\nRef: ";
  const referenceIndex = message.lastIndexOf(referenceMarker);
  const friendlyMessage = referenceIndex < 0 ? message : message.slice(0, referenceIndex);
  const reference = referenceIndex < 0 ? null : message.slice(referenceIndex + referenceMarker.length);

  return (
    <span className="block">
      <span>{friendlyMessage}</span>
      {reference && <span className="mt-1 block text-xs font-normal text-gray-500">Ref: {reference}</span>}
    </span>
  );
}
