# Head-to-Head Comparison Feature

## Overview
The Head-to-Head Comparison feature allows users to compare two team members side-by-side, showing their racing statistics, performance metrics, and direct race results when they've participated in the same events.

## Features

### 1. Member Comparison Statistics
- **Total Races**: Number of races each member has completed
- **Years Racing**: How long each member has been racing
- **Average Races Per Year**: Consistency and dedication metric
- **Total Wins**: Overall race victories
- **Top 3 Finishes**: Podium finishes
- **Best Age Grade**: Highest age-graded performance
- **Average Age Grade**: Overall performance consistency
- **Total Miles**: Cumulative distance raced
- **Geographic Reach**: States and countries raced in

### 2. Head-to-Head Record
- **Direct Wins**: Who won more races when both participated
- **Ties**: Races where both members had the same time
- **Total Shared Races**: Number of races both members participated in

### 3. Shared Race Results
- **Detailed Race List**: All races where both members participated
- **Time Comparison**: Direct time comparison for each race
- **Winner Identification**: Clear indication of who won each race
- **Margin of Victory**: Time difference between finishers
- **Age Grade Comparison**: Performance relative to age standards

## How to Access

### From Member Detail Page
1. Navigate to any member's detail page (`/members/:username/bio`)
2. Click on the "Head-to-Head" button in the navigation
3. Select a team member from the grid to compare
4. View the comprehensive head-to-head comparison

### From Member Stats Page
1. Navigate to any member's statistics page (`/members/:username/stats`)
2. Scroll down to the "Top Team Members Raced With" section
3. Click the "Head-to-Head" button next to any team member
4. This will open the direct comparison page for the two members

### Direct URL Access
- **Selection Mode**: `/members/head-to-head/:member1` (shows team members to select from)
- **Direct Comparison**: `/members/head-to-head/:member1/:member2` (direct comparison of two members)
- Example: `/members/head-to-head/johndoe` or `/members/head-to-head/johndoe/janedoe`

## Technical Implementation

### Files Created/Modified

#### New Files:
- `public/js/controllers/HeadToHeadController.js` - Unified controller for both selection and comparison modes
- `public/views/headToHead.html` - Unified view template for both modes
- `HEAD_TO_HEAD_FEATURE.md` - This documentation file

#### Modified Files:
- `public/js/routes/appRoutes.js` - Added new routes for head-to-head comparison (both standalone and tab)
- `public/views/memberStats.html` - Added "Head-to-Head" button to team members list
- `public/views/memberDetail.html` - Added "Head-to-Head" tab to navigation
- `public/less/mcrrc.less` - Added CSS styles for the head-to-head page and team member cards

### Key Functions

#### HeadToHeadController Methods (Unified):
- `loadHeadToHeadData()` - Main entry point that detects mode and routes accordingly
- `loadSelectionModeData()` - Loads current member and calculates team members (selection mode)
- `loadComparisonModeData()` - Loads both members and their results (comparison mode)
- `calculateTopTeamMembers()` - Identifies team members raced with (selection mode)
- `loadComparison()` - Loads comparison data for selected team member (selection mode)
- `calculateComparisonStats()` - Calculates comprehensive comparison statistics
- `calculateMemberStats()` - Calculates individual member statistics
- `findSharedRaces()` - Identifies races where both members participated
- `calculateHeadToHeadRecord()` - Determines head-to-head win/loss record

### Data Structure

#### Comparison Statistics Object:
```javascript
{
  member1: { /* individual stats */ },
  member2: { /* individual stats */ },
  comparison: {
    totalRaces: { member1: number, member2: number },
    yearsRacing: { member1: number, member2: number },
    // ... other metrics
  }
}
```

#### Shared Races Array:
```javascript
[
  {
    race: { /* race object */ },
    member1Result: { /* result object */ },
    member2Result: { /* result object */ },
    timeDifference: number,
    winner: 'member1' | 'member2',
    isTie: boolean
  }
]
```

## Styling

The feature uses Bootstrap classes with custom CSS enhancements:
- **Member Cards**: Side-by-side comparison with member information
- **Statistics Table**: Responsive table with winner indicators
- **Shared Races Table**: Color-coded rows based on winner
- **Head-to-Head Record**: Visual wells showing win/loss/ties

## Future Enhancements

Potential improvements for future versions:
1. **Performance Charts**: Visual charts comparing performance over time
2. **Personal Bests Comparison**: Side-by-side PB comparison by distance
3. **Racing Timeline**: Visual timeline showing when both members raced
4. **Export Functionality**: PDF or CSV export of comparison data
5. **Advanced Filters**: Filter by race type, year, or location
6. **Mobile Optimization**: Enhanced mobile experience

## Browser Compatibility

The feature uses modern JavaScript features:
- **ES6+ Features**: Arrow functions, destructuring, async/await
- **Modern DOM APIs**: Promise.all, Set operations
- **AngularJS 1.x**: Compatible with existing AngularJS framework

## Performance Considerations

- **Caching**: Leverages existing ResultsService caching
- **Efficient Data Processing**: Uses Set operations for unique values
- **Lazy Loading**: Only loads data when page is accessed
- **Memory Management**: Proper cleanup of large datasets

## Testing

To test the feature:
1. Ensure you have two members with overlapping race participation
2. Navigate to one member's stats page
3. Click "Head-to-Head" on a team member they've raced with
4. Verify all statistics are calculated correctly
5. Check that shared races are properly identified and compared
