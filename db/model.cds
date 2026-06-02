namespace error.outbox;

entity Errors {
  key ID        : UUID;

      hash      : String(64);
      service   : String;
      action    : String;

      message   : LargeString;
      stack     : LargeString;

      count     : Integer;
      firstSeen : Timestamp;
      lastSeen  : Timestamp;

      sent      : Boolean default false;
}
