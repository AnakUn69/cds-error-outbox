using { ErrorOutboxAdminService } from '../srv/admin-service';

// ─── List Report — columns shown in the table ────────────────────────────────

annotate ErrorOutboxAdminService.Errors with @(

  UI.LineItem: [
    { $Type: 'UI.DataField', Value: service,   Label: 'Service'    },
    { $Type: 'UI.DataField', Value: action,    Label: 'Action'     },
    { $Type: 'UI.DataField', Value: message,   Label: 'Message'    },
    { $Type: 'UI.DataField', Value: count,     Label: 'Count'      },
    { $Type: 'UI.DataField', Value: firstSeen, Label: 'First Seen' },
    { $Type: 'UI.DataField', Value: lastSeen,  Label: 'Last Seen'  },
    { $Type: 'UI.DataField', Value: sent,      Label: 'Sent'       },
    {
      $Type:  'UI.DataFieldForAction',
      Action: 'ErrorOutboxAdminService.acknowledge',
      Label:  'Acknowledge'
    }
  ],

  // ─── Enable delete from list ──────────────────────────────────────────────
  UI.DeleteHidden: false,

  // ─── Filter bar fields ────────────────────────────────────────────────────
  UI.SelectionFields: [ service, sent, firstSeen, lastSeen ],

  // ─── Header info (shown above the List Report table) ─────────────────────
  UI.HeaderInfo: {
    TypeName:       'Error',
    TypeNamePlural: 'Errors',
    Title:          { Value: message }
  },

  // ─── Object Page — detail view ────────────────────────────────────────────
  UI.Facets: [
    {
      $Type:  'UI.ReferenceFacet',
      Label:  'Error Details',
      Target: '@UI.FieldGroup#Details'
    },
    {
      $Type:  'UI.ReferenceFacet',
      Label:  'Stack Trace',
      Target: '@UI.FieldGroup#Stack'
    }
  ],

  UI.FieldGroup#Details: {
    Data: [
      { Value: service   },
      { Value: action    },
      { Value: message   },
      { Value: count     },
      { Value: firstSeen },
      { Value: lastSeen  },
      { Value: sent      },
      { Value: hash      }
    ]
  },

  UI.FieldGroup#Stack: {
    Data: [
      { Value: stack }
    ]
  }
);

// ─── Field-level labels and value helps ──────────────────────────────────────

annotate ErrorOutboxAdminService.Errors with {
  ID        @UI.Hidden;
  hash      @title: 'Dedup Hash';
  service   @title: 'Service';
  action    @title: 'Action';
  message   @title: 'Error Message'  @UI.MultiLineText;
  stack     @title: 'Stack Trace'    @UI.MultiLineText;
  count     @title: 'Occurrences';
  firstSeen @title: 'First Seen';
  lastSeen  @title: 'Last Seen';
  sent      @title: 'Sent';
}
