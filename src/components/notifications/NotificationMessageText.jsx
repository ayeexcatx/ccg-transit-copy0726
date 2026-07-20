import React from 'react';

function getMessageParts(notification, message) {
  if (typeof message !== 'string') {
    return { leadingText: message, customText: '', shouldRenderSingleLineAsCustom: false };
  }

  const isOwnerInformationalUpdate = notification?.notification_category === 'dispatch_update_info';
  if (!isOwnerInformationalUpdate) {
    return { leadingText: message, customText: '', shouldRenderSingleLineAsCustom: false };
  }

  const [leadingText, ...customLines] = message.split('\n');
  const customText = customLines.join('\n');

  return {
    leadingText,
    customText,
    shouldRenderSingleLineAsCustom: !customText,
  };
}

export default function NotificationMessageText({
  notification,
  message,
  className = '',
}) {
  const { leadingText, customText, shouldRenderSingleLineAsCustom } = getMessageParts(notification, message);

  if (shouldRenderSingleLineAsCustom) {
    return <p className={className}><span className="text-red-600">{leadingText}</span></p>;
  }

  if (!customText) {
    return <p className={className}>{message}</p>;
  }

  return (
    <p className={className}>
      <span>{leadingText}</span>
      <br />
      <span className="text-red-600">{customText}</span>
    </p>
  );
}
