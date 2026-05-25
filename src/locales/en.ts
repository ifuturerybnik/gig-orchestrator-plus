export default 
{
  "app": {
    "name": "Concertivo",
    "tagline": "Concert and music organization management system"
  },
  "nav": {
    "dashboard": "Dashboard",
    "organizations": "Organizations",
    "profile": "Profile",
    "admin": "Admin panel",
    "approvals": "Approvals",
    "logout": "Log out",
    "login": "Sign in",
    "register": "Sign up"
  },
  "address": {
    "street": "Street and number",
    "city": "City",
    "postal_code": "Postal code",
    "country": "Country"
  },
  "profile": {
    "title": "My profile",
    "subtitle": "Manage your personal info and address.",
    "basic": "Basic info",
    "saved": "Profile saved",
    "kinds": {
      "title": "Who I am",
      "help": "Pick all the roles that describe you. You can change them anytime. Marking incorrect options will cause errors in the organization."
    },
    "address": {
      "title": "Address",
      "optional": "Optional — you can fill this in at any time.",
      "benefit_user": "💡 Providing your address lets the system automatically optimize tour routes, plan travel and handle logistics (accommodation, travel costs)."
    },
    "my_orgs": {
      "title": "My organizations",
      "empty": "You're not assigned to any organization yet."
    },
    "settlement": {
      "title": "Billing & settlement",
      "help": "Preferred settlement form. We use this data to generate concert contracts and invoices.",
      "privacy_note": "🔒 Sensitive data (PESEL, tax ID, bank account) is visible only to you, the owners of organizations you belong to, and the app administrator (i-Future). See Privacy Policy for details.",
      "forms": {
        "employment": {
          "label": "Employment contract with an organization",
          "desc": "I'm employed directly by one of my organizations."
        },
        "business": {
          "label": "Own business (B2B / invoice)",
          "desc": "I invoice from my own company."
        },
        "mandate_contract": {
          "label": "Mandate contract (umowa zlecenie)",
          "desc": "Civil-law contract for services."
        },
        "work_contract": {
          "label": "Specific-task contract (umowa o dzieło)",
          "desc": "Specific-task contract, often with copyright transfer."
        },
        "other": {
          "label": "Other",
          "desc": "Management contract or other — describe below."
        }
      },
      "employer_org": "Employing organization",
      "employer_org_ph": "Pick an organization…",
      "no_orgs": "You don't belong to any organization yet. Join or register a band/company first.",
      "company_name": "Company name",
      "tax_id": "Tax ID (NIP / VAT ID)",
      "vat_payer": "I'm a VAT payer",
      "bank_account": "Bank account (IBAN)",
      "pesel": "National ID (PESEL)",
      "tax_office": "Tax office",
      "tax_office_ph": "e.g. First Tax Office in Warsaw",
      "zus_title": "Social-insurance status",
      "zus_titles": {
        "none": "None / not applicable",
        "student": "Student under 26",
        "employed_elsewhere": "Employed elsewhere (full-time ≥ minimum wage)",
        "retired": "Retired / pensioner",
        "own_business": "I run my own business",
        "other": "Other"
      },
      "other_desc": "Settlement description",
      "default_rate": "Default rate (per concert)",
      "default_currency": "Currency"
    }
  },


  "lang": {
    "label": "Language",
    "pl": "Polski",
    "en": "English"
  },
  "footer": {
    "operator": "Operator: i-Future",
    "privacy": "Privacy Policy",
    "terms": "Terms of Service",
    "contact": "Contact"
  },
  "common": {
    "loading": "Loading…",
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit",
    "back": "Back",
    "next": "Next",
    "approve": "Approve",
    "reject": "Reject",
    "edit": "Edit",
    "delete": "Delete",
    "search": "Search",
    "empty": "No data",
    "error": "Something went wrong",
    "success": "Done"
  },
  "landing": {
    "hero": {
      "title": "Manage concerts, bands and events in one place",
      "subtitle": "Concertivo is a platform for booking agencies, stage and event companies and musicians. Plan, coordinate and settle performances.",
      "cta_primary": "Get started",
      "cta_secondary": "I already have an account"
    }
  },
  "auth": {
    "login": {
      "title": "Sign in",
      "email": "Email address",
      "password": "Password",
      "submit": "Sign in",
      "forgot": "Forgot your password?",
      "no_account": "No account yet?",
      "register_link": "Create one",
      "remember_device": "Remember this device for 30 days"
    },
    "mfa": {
      "prompt": "Enter the 6-digit code from your authenticator app to finish signing in.",
      "code": "Verification code",
      "verify": "Verify",
      "invalid_code": "Invalid code"
    },
    "register": {
      "title": "Create your account",
      "step_account": "Account",
      "step_profile": "Profile",
      "step_kinds": "Who you are",
      "first_name": "First name",
      "last_name": "Last name",
      "phone": "Phone (optional)",
      "email": "Email address",
      "password": "Password",
      "password_confirm": "Confirm password",
      "kinds_help": "Pick all roles that describe you. You can change them later.",
      "submit": "Create account",
      "have_account": "Already have an account?",
      "login_link": "Sign in",
      "check_email": "Check your inbox — we've sent an activation link.",
      "mfa_recommendation": "🔒 We recommend enabling two-factor authentication (2FA) after creating your account — under „Profile → Security”. An extra code from your app significantly improves account security.",
      "accept_legal_prefix": "I accept the",
      "accept_legal_and": "and the",
      "accept_marketing": "I'd like to receive product updates, event news and offers (optional — you can opt out anytime)."
    },
    "reset": {
      "title": "Reset password",
      "request_subtitle": "Enter your email and we'll send a link to set a new password.",
      "set_subtitle": "Set a new password.",
      "email": "Email address",
      "new_password": "New password",
      "send": "Send link",
      "set": "Set password",
      "sent": "Sent. Check your inbox."
    },
    "errors": {
      "passwords_mismatch": "Passwords don't match",
      "weak_password": "Password must be at least 8 characters",
      "invalid_credentials": "Invalid email or password",
      "select_at_least_one_kind": "Select at least one role",
      "legal_required": "You must accept the Terms and Privacy Policy to continue."
    }
  },
  "user_kinds": {
    "team_manager": "Band manager",
    "musician": "Musician",
    "sound_engineer": "Sound engineer",
    "lighting_engineer": "Lighting engineer",
    "visual_engineer": "Visual / VJ engineer",
    "driver": "Driver",
    "stage_technician": "Stage technician",
    "stage_company_owner": "Stage company owner",
    "event_company_owner": "Event company owner",
    "concert_organizer": "Concert organizer"
  },
  "organizations": {
    "title": "My organizations",
    "new": "Register organization",
    "empty": "You don't have any organizations yet. Register a band or company.",
    "type": {
      "label": "Organization type",
      "band": "Music band",
      "stage_company": "Stage company",
      "event_company": "Event company"
    },
    "status": {
      "label": "Status",
      "pending": "Pending approval",
      "approved": "Approved",
      "rejected": "Rejected"
    },
    "form": {
      "name": "Organization name",
      "description": "Description (optional)",
      "submit": "Submit for approval"
    },
    "members": {
      "title": "Members",
      "invite": "Invite",
      "email_placeholder": "email@example.com",
      "invitation_sent": "Invitation sent",
      "pending_invitations": "Pending invitations",
      "owner": "Owner",
      "member": "Member",
      "remove": "Remove",
      "remove_confirm": "Remove this member from the organization?",
      "cancel_invitation": "Cancel",
      "cancel_invitation_confirm": "Cancel this invitation?",
      "invitation_cancelled": "Invitation cancelled",
      "member_removed": "Member removed",
      "no_name": "(no name)",
      "expires": "Expires"
    },
    "detail": {
      "back": "← Back to list",
      "edit": "Edit organization",
      "save": "Save changes",
      "saved": "Changes saved",
      "rejection_reason": "Rejection reason",
      "basic": "Basic info",
      "address": {
        "title": "Headquarters / base address",
        "optional": "Optional — you can fill this in at any time.",
        "benefit": "💡 Providing the organization's address lets the system automatically optimize tour routes, plan travel from your base and handle logistics (accommodation, travel costs, crew booking)."
      },
      "genres": {
        "title": "Music genre",
        "help": "Pick all genres the band plays. You can change them anytime.",
        "help_single": "Pick the main genre that best describes the band. You can change it anytime."
      },
      "currency": {
        "title": "Currency",
        "label": "Default currency",
        "help": "Currency used in the budget module. Defaults to your address country — you can change it."
      },
      "company": {
        "title": "Company details (for contracts)",
        "help": "Used when generating concert contracts, invoices and other documents. All fields are optional — fill in the ones you actually use.",
        "legal_name": "Full legal name",
        "legal_name_placeholder": "e.g. ACME Music Ltd.",
        "tax_id": "Tax ID / VAT ID",
        "registration_number": "Registration number",
        "court_register_number": "Court register no. (KRS / Companies House)",
        "bank_account": "Bank account (IBAN)",
        "bank_name": "Bank name",
        "signatory_name": "Authorized signatory",
        "signatory_position": "Signatory position",
        "signatory_position_placeholder": "e.g. CEO",
        "contact_email": "Contact email",
        "contact_phone": "Contact phone",
        "website": "Website"
      }
    },
    "genres": {
      "pop_rock": "Pop / Rock",
      "metal_punk": "Metal / Punk",
      "indie_alternative": "Indie / Alternative",
      "hip_hop_rnb": "Hip-hop / R&B / Rap",
      "electronic": "Electronic",
      "jazz_blues": "Jazz / Blues",
      "reggae_ska": "Reggae / Ska",
      "folk_country": "Folk / Country / Acoustic",
      "world_latin": "World music / Latin",
      "classical": "Classical",
      "cover_wedding": "Cover / Wedding",
      "disco_dance": "Disco / Dance",
      "other": "Other"
    },
    "sidebar": {
      "section": "Navigation",
      "overview": "Overview",
      "profile": "Profile",
      "members": "Members",
      "events": "Concerts",
      "budget": "Budget",
      "back_to_list": "← All organizations",
      "pending_expenses": "Pending expenses: {{count}}"
    },
    "events": {
      "title": "Concerts",
      "subtitle": "Plan and manage this organization's concerts.",
      "empty": "No concerts scheduled yet. The concert management module is coming here soon.",
      "coming_soon": "Coming soon"
    },
    "budget": {
      "title": "Budget",
      "intro": "Plan your expenses and budget.",
      "subtitle": "Track this organization's income and expenses.",
      "add": "Add entry",
      "added": "Entry added",
      "deleted": "Entry deleted",
      "delete_confirm": "Delete this budget entry?",
      "invalid_amount": "Invalid amount",
      "empty_list": "No budget entries yet. Add your first income or expense.",
      "summary": "Summary",
      "currency_used": "Organization currency: {{currency}}. Change it in team Profile to use another.",
      "expand": "Show more ({{count}})",
      "collapse": "Collapse list",
      "loading_more": "Loading more entries… ({{remaining}} remaining)",
      "col": {
        "date": "Date",
        "author": "Added by",
        "category": "Category",
        "description": "Description",
        "kind": "Kind",
        "amount_gross": "Gross amount",
        "completed": "Completed",
        "completed_by": "marked by {{name}}"
      },
      "confirm_complete_title": "Mark as completed?",
      "confirm_complete_description": "This action cannot be undone. Do you confirm marking it as completed?",
      "confirm_complete_yes": "Yes, mark",
      "confirm_complete_cancel": "Cancel",
      "kind": {
        "income": "Income",
        "expense": "Expense"
      },
      "categories": {
        "placeholder": "Pick a category…",
        "fee": "Fee",
        "transport": "Transport",
        "accommodation": "Accommodation",
        "meals": "Meals",
        "equipment": "Equipment",
        "rental": "Rental",
        "marketing": "Marketing",
        "venue": "Venue",
        "catering": "Catering",
        "ticket_sales": "Ticket sales",
        "sponsorship": "Sponsorship",
        "merch": "Merch",
        "music_videos": "Music videos",
        "other": "Other",
        "other_custom": "Other (type a new one)…",
        "custom_placeholder": "Type category name"
      },
      "filters": {
        "title": "Filters",
        "date": "Date",
        "date_all": "All dates",
        "date_this_month": "This month",
        "date_prev_month": "Previous month",
        "date_this_year": "This year",
        "date_prev_year": "Previous year",
        "date_custom": "Custom range",
        "author": "Added by",
        "author_all": "Everyone",
        "category": "Category",
        "category_all": "All categories",
        "completed": "Completed",
        "completed_all": "All",
        "completed_yes": "Completed only",
        "completed_no": "Pending only",
        "clear": "Clear filters",
        "pick_range": "Pick range",
        "results": "Matching entries: {{count}}"
      }
    },

    "planned": {
      "title": "Upcoming expenses",
      "subtitle": "Planned income and expenses. Mark \"Completed\" to exclude from the summary.",
      "add": "Add entry",
      "added": "Entry added",
      "deleted": "Entry deleted",
      "delete_confirm": "Delete this entry?",
      "empty_list": "No planned entries yet.",
      "summary": "Summary (pending only)",
      "expand": "Show more ({{count}})",
      "collapse": "Collapse list",
      "pick_date": "Pick a date",
      "move_title": "Move to budget?",
      "move_description": "You marked this entry as completed. This action cannot be undone. Move it to the \"Budget\" table and include it in the summary?",
      "move_yes": "Yes, move",
      "move_no": "No, just mark",
      "moved": "Moved to budget",
      "col": {
        "date": "Date",
        "author": "Added by",
        "category": "Category",
        "description": "Description",
        "planned_date": "Planned date",
        "amount_gross": "Gross amount",
        "completed": "Completed"
      }

    },

    "messages": {
      "created": "Organization submitted. An admin will review it.",
      "approved": "Organization approved.",
      "rejected": "Organization rejected."
    }

  },
  "admin": {
    "approvals": {
      "title": "Organizations awaiting approval",
      "empty": "No pending approvals.",
      "created_by": "Submitted by:",
      "created_at": "Submitted at:"
    }
  }
} as const;
