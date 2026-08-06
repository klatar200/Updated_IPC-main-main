#!/bin/sh
# Stand-in for sendmail, so the harness can assert on what contact.php actually
# mails. PHP invokes sendmail_path with "-t -i" appended and writes the full
# message (headers included, so the To: line is in there) to stdin; this ignores
# the arguments and appends the message to a log.
#
# Exiting 0 is the point: without it mail() returns false and contact.php exits
# 500 at the "mail server could not send" branch, which is BEFORE the auto-reply
# cap — i.e. 4.15b would be untestable end-to-end.
LOG="${IPC_MAIL_LOG:-/tmp/ipc-harness-mail.log}"
{
  echo "===MESSAGE==="
  cat
  echo
} >> "$LOG" 2>/dev/null
exit 0
