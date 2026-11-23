/**
 * Milestone 3.9: Authored Seed Data Generator for Demo Sandboxes
 *
 * Generates 7 days of realistic time log entries, contiguous segments,
 * and pain ratings relative to the visitor's current local date and time.
 */

export interface SeedSegmentData {
  offsetMinutesStart: number;
  offsetMinutesEnd: number;
  activity_label: string;
  category: string;
  company?: string[];
}

export interface SeedEntryTemplate {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  raw_text: string;
  on_vacation?: boolean;
  painRating?: number; // 1-4
  segments: Array<{
    durationMinutes: number;
    activity_label: string;
    category: string;
    company?: string[];
  }>;
}

// 3 Core Day Templates as specified in SPEC-3.8 Step 3:
// Template A: Working Weekday (Variations A1, A2, A3, A4)
// Template B: Weekend with an Event (Variations B1, B2)
// Template C: Vacation Day (where on_vacation is true and every segment is 'vacation')

export interface DayTemplate {
  name: string;
  on_vacation?: boolean;
  entries: SeedEntryTemplate[];
  standaloneRatings?: Array<{ hour: number; minute: number; rating: number }>;
}

export const DAY_TEMPLATES: DayTemplate[] = [
  // Day -6 (Weekday A1: Focus on work, admin, chores, health)
  {
    name: 'Weekday A1',
    entries: [
      {
        startHour: 0, startMinute: 0, endHour: 7, endMinute: 30,
        raw_text: 'went to bed early and slept straight through the night',
        segments: [{ durationMinutes: 450, activity_label: 'sleeping', category: 'sleep' }],
      },
      {
        startHour: 7, startMinute: 30, endHour: 8, endMinute: 30,
        raw_text: 'woke up, showered and did morning skincare, made coffee and toast',
        painRating: 2,
        segments: [
          { durationMinutes: 30, activity_label: 'showering and skincare', category: 'personal care' },
          { durationMinutes: 30, activity_label: 'breakfast', category: 'meals' },
        ],
      },
      {
        startHour: 8, startMinute: 30, endHour: 9, endMinute: 30,
        raw_text: 'worked on course assignment and research notes',
        painRating: 2,
        segments: [{ durationMinutes: 60, activity_label: 'coursework and research', category: 'study & learning' }],
      },
      {
        startHour: 9, startMinute: 30, endHour: 10, endMinute: 30,
        raw_text: 'paid electricity and wifi bills, then sorted out messy email inbox',
        painRating: 3,
        segments: [{ durationMinutes: 60, activity_label: 'bills and inbox triage', category: 'admin' }],
      },
      {
        startHour: 10, startMinute: 30, endHour: 11, endMinute: 30,
        raw_text: 'drove to the dentist and had my cleaning',
        painRating: 3,
        segments: [
          { durationMinutes: 20, activity_label: 'driving to dentist', category: 'healthcare' },
          { durationMinutes: 40, activity_label: 'teeth cleaning appointment', category: 'healthcare' },
        ],
      },
      {
        startHour: 11, startMinute: 30, endHour: 12, endMinute: 30,
        raw_text: 'ate leftover soup for lunch while watching YouTube design videos',
        painRating: 2,
        segments: [
          { durationMinutes: 30, activity_label: 'lunch', category: 'meals' },
          { durationMinutes: 30, activity_label: 'watching design videos', category: 'entertainment' },
        ],
      },
      {
        startHour: 12, startMinute: 30, endHour: 14, endMinute: 0,
        raw_text: 'worked on client redesign revisions and prototype review',
        painRating: 3,
        segments: [{ durationMinutes: 90, activity_label: 'client project revisions', category: 'work' }],
      },
      {
        startHour: 14, startMinute: 0, endHour: 15, endMinute: 0,
        raw_text: 'scrolled on my phone because i was avoiding the dishes',
        painRating: 3,
        segments: [{ durationMinutes: 60, activity_label: 'scrolling on phone', category: 'screen time' }],
      },
      {
        startHour: 15, startMinute: 0, endHour: 16, endMinute: 30,
        raw_text: 'washed the mountain of dishes and wiped down counters, then took out trash',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'kitchen cleaning', category: 'chores' }],
      },
      {
        startHour: 16, startMinute: 30, endHour: 18, endMinute: 0,
        raw_text: 'went for a brisk walk around the neighborhood with Sam',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'afternoon walk', category: 'exercise', company: ['Sam'] }],
      },
      {
        startHour: 18, startMinute: 0, endHour: 24, endMinute: 0,
        raw_text: 'cooked pasta dinner with roommate, watched a movie, then read my novel until bedtime',
        segments: [
          { durationMinutes: 90, activity_label: 'making dinner', category: 'meals', company: ['roommate'] },
          { durationMinutes: 150, activity_label: 'watching a movie', category: 'entertainment', company: ['roommate'] },
          { durationMinutes: 120, activity_label: 'reading fiction', category: 'reading' },
        ],
      },
    ],
    standaloneRatings: [{ hour: 13, minute: 30, rating: 3 }],
  },

  // Day -5 (Weekday A2: Work, errands, creative hobby, social)
  {
    name: 'Weekday A2',
    entries: [
      {
        startHour: 0, startMinute: 0, endHour: 7, endMinute: 0,
        raw_text: 'slept peacefully',
        segments: [{ durationMinutes: 420, activity_label: 'sleeping', category: 'sleep' }],
      },
      {
        startHour: 7, startMinute: 0, endHour: 8, endMinute: 0,
        raw_text: 'woke up, stretched, washed face, made oatmeal with blueberries',
        painRating: 2,
        segments: [
          { durationMinutes: 25, activity_label: 'morning stretching', category: 'exercise' },
          { durationMinutes: 35, activity_label: 'breakfast', category: 'meals' },
        ],
      },
      {
        startHour: 8, startMinute: 0, endHour: 9, endMinute: 30,
        raw_text: 'tailored resume and submitted two project applications',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'submitting applications', category: 'work' }],
      },
      {
        startHour: 9, startMinute: 30, endHour: 10, endMinute: 30,
        raw_text: 'coffee chat on zoom with Dana about career plans',
        painRating: 2,
        segments: [{ durationMinutes: 60, activity_label: 'career coffee chat', category: 'social', company: ['Dana'] }],
      },
      {
        startHour: 10, startMinute: 30, endHour: 12, endMinute: 0,
        raw_text: 'drove to post office to drop packages, then got groceries at trader joes',
        painRating: 3,
        segments: [
          { durationMinutes: 30, activity_label: 'post office errands', category: 'errands' },
          { durationMinutes: 60, activity_label: 'grocery shopping', category: 'errands' },
        ],
      },
      {
        startHour: 12, startMinute: 0, endHour: 13, endMinute: 0,
        raw_text: 'unpacked groceries and made a warm turkey sandwich for lunch',
        painRating: 2,
        segments: [{ durationMinutes: 60, activity_label: 'lunch', category: 'meals' }],
      },
      {
        startHour: 13, startMinute: 0, endHour: 15, endMinute: 0,
        raw_text: 'client work on project synthesis and presentation deck',
        painRating: 3,
        segments: [{ durationMinutes: 120, activity_label: 'client project work', category: 'work' }],
      },
      {
        startHour: 15, startMinute: 0, endHour: 16, endMinute: 0,
        raw_text: 'browsed online feeds for design ideas and recipes',
        painRating: 2,
        segments: [{ durationMinutes: 60, activity_label: 'browsing online feeds', category: 'screen time' }],
      },
      {
        startHour: 16, startMinute: 0, endHour: 17, endMinute: 0,
        raw_text: 'practiced acoustic guitar for 40 minutes, then texted my roommate',
        painRating: 2,
        segments: [
          { durationMinutes: 40, activity_label: 'guitar practice', category: 'hobbies & creative' },
          { durationMinutes: 20, activity_label: 'texting about groceries', category: 'social', company: ['roommate'] },
        ],
      },
      {
        startHour: 17, startMinute: 0, endHour: 24, endMinute: 0,
        raw_text: 'dinner at home, watercolor painting in my sketchbook, and reading before bed',
        segments: [
          { durationMinutes: 60, activity_label: 'dinner', category: 'meals' },
          { durationMinutes: 180, activity_label: 'watercolor painting', category: 'hobbies & creative' },
          { durationMinutes: 180, activity_label: 'reading', category: 'reading' },
        ],
      },
    ],
  },

  // Day -4 (Vacation Day C: on_vacation = true, trip to the coast)
  {
    name: 'Vacation C',
    on_vacation: true,
    entries: [
      {
        startHour: 0, startMinute: 0, endHour: 7, endMinute: 30,
        raw_text: 'slept in hotel room by the coast',
        on_vacation: true,
        segments: [{ durationMinutes: 450, activity_label: 'sleeping on vacation', category: 'vacation' }],
      },
      {
        startHour: 7, startMinute: 30, endHour: 9, endMinute: 0,
        raw_text: 'got ready, morning coffee and pastries on the balcony with Priya',
        on_vacation: true,
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'balcony breakfast', category: 'vacation', company: ['Priya'] }],
      },
      {
        startHour: 9, startMinute: 0, endHour: 12, endMinute: 0,
        raw_text: 'walked along the coastal cliffs and beachcombed with Priya',
        on_vacation: true,
        painRating: 2,
        segments: [{ durationMinutes: 180, activity_label: 'coastal cliff hike', category: 'vacation', company: ['Priya'] }],
      },
      {
        startHour: 12, startMinute: 0, endHour: 13, endMinute: 30,
        raw_text: 'ate lunch at a seaside seafood cafe near the harbor',
        on_vacation: true,
        painRating: 1,
        segments: [{ durationMinutes: 90, activity_label: 'seaside lunch', category: 'vacation', company: ['Priya'] }],
      },
      {
        startHour: 13, startMinute: 30, endHour: 16, endMinute: 0,
        raw_text: 'browsed vintage bookshops and artisan stalls in town',
        on_vacation: true,
        painRating: 2,
        segments: [{ durationMinutes: 150, activity_label: 'town shops exploring', category: 'vacation', company: ['Priya'] }],
      },
      {
        startHour: 16, startMinute: 0, endHour: 18, endMinute: 0,
        raw_text: 'rested back at the inn and read by the window',
        on_vacation: true,
        painRating: 2,
        segments: [{ durationMinutes: 120, activity_label: 'reading and relaxing', category: 'vacation' }],
      },
      {
        startHour: 18, startMinute: 0, endHour: 21, endMinute: 0,
        raw_text: 'dinner at the tavern by the dock with live acoustic music',
        on_vacation: true,
        painRating: 2,
        segments: [{ durationMinutes: 180, activity_label: 'dockside dinner', category: 'vacation', company: ['Priya'] }],
      },
      {
        startHour: 21, startMinute: 0, endHour: 24, endMinute: 0,
        raw_text: 'stargazing on the beach then headed up to bed',
        on_vacation: true,
        segments: [{ durationMinutes: 180, activity_label: 'night walk on beach', category: 'vacation', company: ['Priya'] }],
      },
    ],
    standaloneRatings: [{ hour: 15, minute: 0, rating: 2 }],
  },

  // Day -3 (Weekday A3: Work, healthcare, shopping, learning)
  {
    name: 'Weekday A3',
    entries: [
      {
        startHour: 0, startMinute: 0, endHour: 7, endMinute: 0,
        raw_text: 'slept deeply',
        segments: [{ durationMinutes: 420, activity_label: 'sleeping', category: 'sleep' }],
      },
      {
        startHour: 7, startMinute: 0, endHour: 8, endMinute: 0,
        raw_text: 'morning coffee and toast, quick shower and got dressed',
        painRating: 2,
        segments: [
          { durationMinutes: 30, activity_label: 'breakfast', category: 'meals' },
          { durationMinutes: 30, activity_label: 'getting ready', category: 'personal care' },
        ],
      },
      {
        startHour: 8, startMinute: 0, endHour: 10, endMinute: 0,
        raw_text: 'deep work on design system components and token documentation',
        painRating: 3,
        segments: [{ durationMinutes: 120, activity_label: 'design system work', category: 'work' }],
      },
      {
        startHour: 10, startMinute: 0, endHour: 11, endMinute: 30,
        raw_text: 'physical therapy appointment for shoulder rehab',
        painRating: 3,
        segments: [
          { durationMinutes: 15, activity_label: 'driving to physical therapy', category: 'healthcare' },
          { durationMinutes: 60, activity_label: 'physical therapy session', category: 'healthcare' },
          { durationMinutes: 15, activity_label: 'driving home', category: 'healthcare' },
        ],
      },
      {
        startHour: 11, startMinute: 30, endHour: 12, endMinute: 30,
        raw_text: 'made a big salad for lunch and caught up on messages with Dana',
        painRating: 2,
        segments: [
          { durationMinutes: 30, activity_label: 'lunch', category: 'meals' },
          { durationMinutes: 30, activity_label: 'chatting with Dana', category: 'social', company: ['Dana'] },
        ],
      },
      {
        startHour: 12, startMinute: 30, endHour: 14, endMinute: 30,
        raw_text: 'freelance project illustrations and icon set exports',
        painRating: 3,
        segments: [{ durationMinutes: 120, activity_label: 'freelance illustration', category: 'work' }],
      },
      {
        startHour: 14, startMinute: 30, endHour: 15, endMinute: 30,
        raw_text: 'walked to the craft store and bought knitting yarn and sketch pads',
        painRating: 2,
        segments: [{ durationMinutes: 60, activity_label: 'craft store shopping', category: 'shopping' }],
      },
      {
        startHour: 15, startMinute: 30, endHour: 17, endMinute: 0,
        raw_text: 'worked through an online design course and took notes',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'online design course', category: 'study & learning' }],
      },
      {
        startHour: 17, startMinute: 0, endHour: 24, endMinute: 0,
        raw_text: 'made stir fry for dinner, knitted while listening to an audiobook, went to sleep',
        segments: [
          { durationMinutes: 60, activity_label: 'cooking dinner', category: 'meals' },
          { durationMinutes: 120, activity_label: 'knitting sweater', category: 'hobbies & creative' },
          { durationMinutes: 240, activity_label: 'reading audiobook', category: 'reading' },
        ],
      },
    ],
  },

  // Day -2 (Weekend B1: Saturday with Event - Concert with Priya and Sam)
  {
    name: 'Weekend Event B1',
    entries: [
      {
        startHour: 0, startMinute: 0, endHour: 8, endMinute: 0,
        raw_text: 'slept in late on saturday morning',
        segments: [{ durationMinutes: 480, activity_label: 'sleeping in', category: 'sleep' }],
      },
      {
        startHour: 8, startMinute: 0, endHour: 9, endMinute: 30,
        raw_text: 'lazy morning coffee, scrolled news and social media in bed',
        painRating: 2,
        segments: [
          { durationMinutes: 45, activity_label: 'breakfast in bed', category: 'meals' },
          { durationMinutes: 45, activity_label: 'browsing social media', category: 'screen time' },
        ],
      },
      {
        startHour: 9, startMinute: 30, endHour: 11, endMinute: 0,
        raw_text: 'deep cleaned the living room, vacuumed rugs and dusted shelves',
        painRating: 3,
        segments: [{ durationMinutes: 90, activity_label: 'weekend cleaning', category: 'chores' }],
      },
      {
        startHour: 11, startMinute: 0, endHour: 12, endMinute: 30,
        raw_text: 'acoustic guitar practice and worked on new chords',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'guitar practice', category: 'hobbies & creative' }],
      },
      {
        startHour: 12, startMinute: 30, endHour: 14, endMinute: 0,
        raw_text: 'met Dana for lunch at the bakery patio and talked about books',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'bakery lunch', category: 'meals', company: ['Dana'] }],
      },
      {
        startHour: 14, startMinute: 0, endHour: 16, endMinute: 0,
        raw_text: 'hair wash, got ready and dressed up for evening concert',
        painRating: 2,
        segments: [{ durationMinutes: 120, activity_label: 'getting ready and styling', category: 'personal care' }],
      },
      {
        startHour: 16, startMinute: 0, endHour: 19, endMinute: 30,
        raw_text: 'concert with Priya and Sam at the music hall',
        painRating: 3,
        segments: [
          { durationMinutes: 30, activity_label: 'travel to venue', category: 'entertainment', company: ['Priya', 'Sam'] },
          { durationMinutes: 180, activity_label: 'live concert performance', category: 'entertainment', company: ['Priya', 'Sam'] },
        ],
      },
      {
        startHour: 19, startMinute: 30, endHour: 22, endMinute: 0,
        raw_text: 'late dinner and dessert with Priya and Sam after the concert',
        painRating: 2,
        segments: [{ durationMinutes: 150, activity_label: 'post-concert dinner', category: 'meals', company: ['Priya', 'Sam'] }],
      },
      {
        startHour: 22, startMinute: 0, endHour: 24, endMinute: 0,
        raw_text: 'got home, washed face and got ready for bed',
        segments: [
          { durationMinutes: 30, activity_label: 'travel home from concert', category: 'entertainment' },
          { durationMinutes: 90, activity_label: 'night routine', category: 'personal care' },
        ],
      },
    ],
    standaloneRatings: [{ hour: 13, minute: 30, rating: 2 }],
  },

  // Day -1 (Weekend B2: Sunday - Brunch, farmers market, friends, rest)
  {
    name: 'Weekend B2',
    entries: [
      {
        startHour: 0, startMinute: 0, endHour: 8, endMinute: 30,
        raw_text: 'slept 8 and a half hours',
        segments: [{ durationMinutes: 510, activity_label: 'sleeping', category: 'sleep' }],
      },
      {
        startHour: 8, startMinute: 30, endHour: 9, endMinute: 30,
        raw_text: 'made french toast and tea with roommate',
        painRating: 2,
        segments: [{ durationMinutes: 60, activity_label: 'sunday breakfast', category: 'meals', company: ['roommate'] }],
      },
      {
        startHour: 9, startMinute: 30, endHour: 11, endMinute: 30,
        raw_text: 'walked to the farmers market and bought fresh flowers and bread with Sam',
        painRating: 2,
        segments: [
          { durationMinutes: 60, activity_label: 'farmers market stroll', category: 'errands', company: ['Sam'] },
          { durationMinutes: 60, activity_label: 'coffee stand hangout', category: 'social', company: ['Sam'] },
        ],
      },
      {
        startHour: 11, startMinute: 30, endHour: 13, endMinute: 0,
        raw_text: 'gardening on the back patio and repotted houseplants',
        painRating: 3,
        segments: [{ durationMinutes: 90, activity_label: 'plant repotting and gardening', category: 'hobbies & creative' }],
      },
      {
        startHour: 13, startMinute: 0, endHour: 14, endMinute: 30,
        raw_text: 'sunday lunch and organized weekly planner and schedule',
        painRating: 2,
        segments: [
          { durationMinutes: 45, activity_label: 'lunch', category: 'meals' },
          { durationMinutes: 45, activity_label: 'weekly planning', category: 'admin' },
        ],
      },
      {
        startHour: 14, startMinute: 30, endHour: 16, endMinute: 0,
        raw_text: 'read 60 pages of my book on the sofa with chamomile tea',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'reading novel', category: 'reading' }],
      },
      {
        startHour: 16, startMinute: 0, endHour: 17, endMinute: 30,
        raw_text: 'afternoon yoga session and light stretching for back pain',
        painRating: 2,
        segments: [{ durationMinutes: 90, activity_label: 'restorative yoga', category: 'exercise' }],
      },
      {
        startHour: 17, startMinute: 30, endHour: 24, endMinute: 0,
        raw_text: 'cooked dinner, called Dana to catch up, watched a series with roommate, went to bed',
        segments: [
          { durationMinutes: 60, activity_label: 'cooking dinner', category: 'meals' },
          { durationMinutes: 60, activity_label: 'phone call with Dana', category: 'social', company: ['Dana'] },
          { durationMinutes: 120, activity_label: 'watching tv series', category: 'entertainment', company: ['roommate'] },
          { durationMinutes: 150, activity_label: 'lying down trying to sleep', category: 'sleep' },
        ],
      },
    ],
  },
];

// Today's schedule template (Day 0)
// Starts at 00:00 (sleep) and progresses up to ~90 minutes before current time.
export const TODAY_ENTRY_BLUEPRINTS: SeedEntryTemplate[] = [
  {
    startHour: 0, startMinute: 0, endHour: 7, endMinute: 15,
    raw_text: 'slept soundly until my alarm went off',
    segments: [{ durationMinutes: 435, activity_label: 'sleeping', category: 'sleep' }],
  },
  {
    startHour: 7, startMinute: 15, endHour: 8, endMinute: 15,
    raw_text: 'woke up, morning shower, brewed coffee and scrambled eggs',
    painRating: 2,
    segments: [
      { durationMinutes: 30, activity_label: 'shower and routine', category: 'personal care' },
      { durationMinutes: 30, activity_label: 'breakfast', category: 'meals' },
    ],
  },
  {
    startHour: 8, startMinute: 15, endHour: 9, endMinute: 30,
    raw_text: 'reviewed course materials and updated presentation slides',
    painRating: 2,
    segments: [{ durationMinutes: 75, activity_label: 'course study and notes', category: 'study & learning' }],
  },
  {
    startHour: 9, startMinute: 30, endHour: 10, endMinute: 30,
    raw_text: 'answered emails, paid credit card statement, scheduled vet appointment',
    painRating: 3,
    segments: [{ durationMinutes: 60, activity_label: 'admin and scheduling', category: 'admin' }],
  },
  {
    startHour: 10, startMinute: 30, endHour: 11, endMinute: 45,
    raw_text: 'worked on design system typography scale and component specs',
    painRating: 3,
    segments: [{ durationMinutes: 75, activity_label: 'design system specs', category: 'work' }],
  },
  {
    startHour: 11, startMinute: 45, endHour: 12, endMinute: 45,
    raw_text: 'made avocado toast and tomato soup for lunch with roommate',
    painRating: 2,
    segments: [{ durationMinutes: 60, activity_label: 'lunch with roommate', category: 'meals', company: ['roommate'] }],
  },
  {
    startHour: 12, startMinute: 45, endHour: 14, endMinute: 0,
    raw_text: 'scrolled through feeds on phone before getting back to desk',
    painRating: 3,
    segments: [{ durationMinutes: 75, activity_label: 'scrolling on phone', category: 'screen time' }],
  },
  {
    startHour: 14, startMinute: 0, endHour: 15, endMinute: 30,
    raw_text: 'worked on client wireframes and user flow mapping',
    painRating: 3,
    segments: [{ durationMinutes: 90, activity_label: 'wireframing user flows', category: 'work' }],
  },
  {
    startHour: 15, startMinute: 30, endHour: 17, endMinute: 0,
    raw_text: 'practiced acoustic guitar for 45 minutes then texted Sam about dinner plans',
    painRating: 2,
    segments: [
      { durationMinutes: 45, activity_label: 'guitar practice', category: 'hobbies & creative' },
      { durationMinutes: 45, activity_label: 'texting Sam', category: 'social', company: ['Sam'] },
    ],
  },
  {
    startHour: 17, startMinute: 0, endHour: 18, endMinute: 30,
    raw_text: 'went for an evening run in the park with Dana',
    painRating: 2,
    segments: [{ durationMinutes: 90, activity_label: 'evening running', category: 'exercise', company: ['Dana'] }],
  },
  {
    startHour: 18, startMinute: 30, endHour: 20, endMinute: 0,
    raw_text: 'dinner and tea at home while reading articles',
    painRating: 2,
    segments: [
      { durationMinutes: 45, activity_label: 'dinner', category: 'meals' },
      { durationMinutes: 45, activity_label: 'reading articles', category: 'reading' },
    ],
  },
];

/**
 * Converts local (year, month, day, hour, minute) in target timeZone into an ISO 8601 string with UTC offset.
 */
export function buildIsoWithOffset(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(dtf.formatToParts(guess).map((p) => [p.type, p.value]));
  const tzHour = parts.hour === '24' ? 0 : parseInt(parts.hour, 10);
  const guessInTz = new Date(Date.UTC(parseInt(parts.year, 10), parseInt(parts.month, 10) - 1, parseInt(parts.day, 10), tzHour, parseInt(parts.minute, 10)));
  const diffMs = guess.getTime() - guessInTz.getTime();
  const actualDate = new Date(guess.getTime() + diffMs);

  const parts2 = Object.fromEntries(dtf.formatToParts(actualDate).map((p) => [p.type, p.value]));
  const offsetMin = -Math.round(
    (actualDate.getTime() -
      new Date(
        Date.UTC(
          parseInt(parts2.year, 10),
          parseInt(parts2.month, 10) - 1,
          parseInt(parts2.day, 10),
          parts2.hour === '24' ? 0 : parseInt(parts2.hour, 10),
          parseInt(parts2.minute, 10)
        )
      ).getTime()) /
      60000
  );

  const sign = offsetMin <= 0 ? '-' : '+';
  const absOffset = Math.abs(offsetMin);
  const offsetStr = `${sign}${pad(Math.floor(absOffset / 60))}:${pad(absOffset % 60)}`;

  return `${parts2.year}-${parts2.month}-${parts2.day}T${parts2.hour}:${parts2.minute}:00${offsetStr}`;
}

export interface GeneratedSeedData {
  entries: Array<{
    id: string;
    user_id: string;
    raw_text: string;
    window_start: string;
    window_end: string;
    parse_status: 'parsed';
    on_vacation: boolean;
    created_at: string;
  }>;
  segments: Array<{
    id: string;
    entry_id: string;
    user_id: string;
    start_time: string;
    end_time: string;
    activity_label: string;
    category: string;
    company: string[];
    confirmed: true;
    model: 'seed';
    prompt_version: 'seed';
  }>;
  painRatings: Array<{
    id: string;
    user_id: string;
    entry_id: string | null;
    rating: number;
    rated_at: string;
    created_at: string;
  }>;
}

/**
 * Generates the full 7 days of demo data tailored to the visitor's current time and time zone.
 */
export function generateDemoSeedData(userId: string, timeZone: string, now: Date = new Date()): GeneratedSeedData {
  const result: GeneratedSeedData = {
    entries: [],
    segments: [],
    painRatings: [],
  };

  // 1. Determine local year, month, date, hour, minute in visitor's timeZone for now
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const nowParts = Object.fromEntries(dtf.formatToParts(now).map((p) => [p.type, p.value]));
  const localYear = parseInt(nowParts.year, 10);
  const localMonth = parseInt(nowParts.month, 10);
  const localDay = parseInt(nowParts.day, 10);
  const localHour = nowParts.hour === '24' ? 0 : parseInt(nowParts.hour, 10);
  const localMinute = parseInt(nowParts.minute, 10);

  // Target cutoff for today is roughly 90 minutes before current local time
  const currentTotalMinutes = localHour * 60 + localMinute;
  const todayCutoffMinutes = Math.max(8 * 60, currentTotalMinutes - 90); // at least cover morning sleep + breakfast

  // 13 full past days (dayOffsets -13 to -1) + today = 14 days (SPEC-3.9 Milestone 4.5)
  const pastDays = [-13, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1];

  // Weekday templates with work segments
  const weekdayTemplates = [
    DAY_TEMPLATES[0], // Weekday A1
    DAY_TEMPLATES[1], // Weekday A2
    DAY_TEMPLATES[3], // Weekday A3
  ];

  // Weekend templates
  const weekendTemplates = [
    DAY_TEMPLATES[4], // Weekend Event B1
    DAY_TEMPLATES[5], // Weekend B2
  ];

  let weekdayIdx = 0;
  let weekendIdx = 0;

  for (let i = 0; i < pastDays.length; i++) {
    const dayOffset = pastDays[i];

    // Compute calendar date for this past day
    const baseDate = new Date(Date.UTC(localYear, localMonth - 1, localDay + dayOffset));
    const y = baseDate.getUTCFullYear();
    const m = baseDate.getUTCMonth() + 1;
    const d = baseDate.getUTCDate();

    // Check if weekend (Saturday or Sunday) in the target timezone
    const weekdayShort = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(baseDate);
    const isWeekend = weekdayShort === 'Sat' || weekdayShort === 'Sun';

    const template = isWeekend
      ? weekendTemplates[weekendIdx++ % weekendTemplates.length]
      : weekdayTemplates[weekdayIdx++ % weekdayTemplates.length];

    // Next day's date for midnight wrap
    const nextDate = new Date(Date.UTC(localYear, localMonth - 1, localDay + dayOffset + 1));
    const nextY = nextDate.getUTCFullYear();
    const nextM = nextDate.getUTCMonth() + 1;
    const nextD = nextDate.getUTCDate();

    for (const ent of template.entries) {
      const entryId = crypto.randomUUID();
      const startIso = buildIsoWithOffset(y, m, d, ent.startHour, ent.startMinute, timeZone);
      const endIso =
        ent.endHour === 24
          ? buildIsoWithOffset(nextY, nextM, nextD, 0, 0, timeZone)
          : buildIsoWithOffset(y, m, d, ent.endHour, ent.endMinute, timeZone);

      result.entries.push({
        id: entryId,
        user_id: userId,
        raw_text: ent.raw_text,
        window_start: startIso,
        window_end: endIso,
        parse_status: 'parsed',
        on_vacation: Boolean(template.on_vacation || ent.on_vacation),
        created_at: endIso,
      });

      // Build segments
      let curOffset = 0;
      const sDate = new Date(startIso);
      for (const seg of ent.segments) {
        const segStartMs = sDate.getTime() + curOffset * 60000;
        const segEndMs = segStartMs + seg.durationMinutes * 60000;
        curOffset += seg.durationMinutes;

        result.segments.push({
          id: crypto.randomUUID(),
          entry_id: entryId,
          user_id: userId,
          start_time: new Date(segStartMs).toISOString(),
          end_time: new Date(segEndMs).toISOString(),
          activity_label: seg.activity_label,
          category: template.on_vacation || ent.on_vacation ? 'vacation' : seg.category,
          company: seg.company ? [...seg.company] : [],
          confirmed: true,
          model: 'seed',
          prompt_version: 'seed',
        });
      }

      // Pain rating linked to entry
      if (ent.painRating) {
        result.painRatings.push({
          id: crypto.randomUUID(),
          user_id: userId,
          entry_id: entryId,
          rating: ent.painRating,
          rated_at: endIso,
          created_at: endIso,
        });
      }
    }

    // Standalone ratings for this day
    if (template.standaloneRatings) {
      for (const sr of template.standaloneRatings) {
        const ratedIso = buildIsoWithOffset(y, m, d, sr.hour, sr.minute, timeZone);
        result.painRatings.push({
          id: crypto.randomUUID(),
          user_id: userId,
          entry_id: null,
          rating: sr.rating,
          rated_at: ratedIso,
          created_at: ratedIso,
        });
      }
    }
  }

  // Today (dayOffset 0): stop ~90 minutes before now
  for (const ent of TODAY_ENTRY_BLUEPRINTS) {
    const entEndTotalMinutes = ent.endHour * 60 + ent.endMinute;
    if (entEndTotalMinutes > todayCutoffMinutes) {
      break; // Stop here so Log screen opens with a sensible default start time!
    }

    const entryId = crypto.randomUUID();
    const startIso = buildIsoWithOffset(localYear, localMonth, localDay, ent.startHour, ent.startMinute, timeZone);
    const endIso = buildIsoWithOffset(localYear, localMonth, localDay, ent.endHour, ent.endMinute, timeZone);

    result.entries.push({
      id: entryId,
      user_id: userId,
      raw_text: ent.raw_text,
      window_start: startIso,
      window_end: endIso,
      parse_status: 'parsed',
      on_vacation: Boolean(ent.on_vacation),
      created_at: endIso,
    });

    let curOffset = 0;
    const sDate = new Date(startIso);
    for (const seg of ent.segments) {
      const segStartMs = sDate.getTime() + curOffset * 60000;
      const segEndMs = segStartMs + seg.durationMinutes * 60000;
      curOffset += seg.durationMinutes;

      result.segments.push({
        id: crypto.randomUUID(),
        entry_id: entryId,
        user_id: userId,
        start_time: new Date(segStartMs).toISOString(),
        end_time: new Date(segEndMs).toISOString(),
        activity_label: seg.activity_label,
        category: seg.category,
        company: seg.company ? [...seg.company] : [],
        confirmed: true,
        model: 'seed',
        prompt_version: 'seed',
      });
    }

    if (ent.painRating) {
      result.painRatings.push({
        id: crypto.randomUUID(),
        user_id: userId,
        entry_id: entryId,
        rating: ent.painRating,
        rated_at: endIso,
        created_at: endIso,
      });
    }
  }

  return result;
}
