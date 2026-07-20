export const LEGACY_DRIVER_PROTOCOL_TITLE = 'OPERATIONS PROTOCOL';

export const LEGACY_DRIVER_PROTOCOL_CONTENT = [
  {
    heading: 'JOBSITE PROTOCOL',
    body: [
      'a. Hauler shall adhere to the job specific instructions dispatched by CCG.',
      'c. The CCG dispatcher has full authority to assign, modify, or reassign work as necessary to meet project requirements.',
      'd. Delays must be reported immediately. Waiting to report a delay until after the scheduled start time is considered late notice.',
      'Although an assignment may be listed as a supplemental assignment, Hauler is fully expected to complete all assignments dispatched.',
      'If there is an issue that may prevent Hauler from completing an assignment, Hauler must notify CCG immediately so it can be addressed.',
      'e. The Hauler shall ensure the dump body is clean prior to the scheduled start time.',
      'f. Trucks sent home due to a dirty dump body will be compensated only for the actual time worked prior to removal from service.',
      'g. The Hauler shall remove the tow hitch from the dump truck.',
      'h. The Hauler shall remove secondary air lines and connections.',
      'i. The Hauler must check in at the assigned job site at the scheduled time as directed by the CCG dispatcher.',
      'j. The Hauler must verify check-out with Earle personnel upon completion of the assignment.',
      'k. Any breakdowns, late arrivals, or call-outs must be reported immediately to the CCG dispatcher.',
      'Example:',
      'You are on your way to the job that starts at 7:00am. It is 6:30am and you are 20 minutes away, ETA is 6:50am. Suddenly, smoke starts billowing from your hood.',
      'The moment you safely pull over and stop, you already know that you are not going to make it on time. Report the delay first.',
      'Do not stop and diagnose the problem, then call at 7:15am saying that you are going to be late.',
      'DO NOT WAIT — CALL IF LATE',
      'Failure to report a no-show or call-out may result in the Hauler being back-charged for the time required for a replacement truck to arrive at the assigned job.',
      'l. CB Radios',
      'CB radios must be on and fully operational at all times.',
      'Drivers must verify the correct channel at the jobsite.',
      'Drivers must verify the correct channel at the plant.',
      'Note: Typically always channel number 1',
      'm. Boots only. All other footwear is strictly prohibited.',
      'n. All Hauler personnel must wear a safety vest at all times while on the job.',
      'o. All Hauler personnel must wear a hard hat when outside the truck.',
      'p. Raising the dump body on the job is strictly prohibited.',
      'q. Cleaning is permitted only in front of the milling operations or at the plant.',
      'r. Speeding on the jobsite is strictly prohibited.',
      's. Stopping in a live lane is strictly prohibited.',
      't. Driving in the reverse position in a live lane is strictly prohibited.',
      'u. No stops are permitted when the truck is loaded with asphalt. Time will be deducted for any violation.',
      'v. A regen is inevitable and part of the federal safety standards for emissions. If the Hauler is experiencing a regen with the vehicle, the following must be provided:',
      'A time stamped short video that displays the dash with the regen light illuminated.',
      '1 time stamped photo when the regen begins.',
      '1 time stamped photo when the regen is complete.',
      'Note: Failure to provide these requirements will result in a time deduction.',
      'w. In the event of any issue or operational concern, the Hauler must immediately contact the CCG dispatcher.',
      'x. Unprofessional conduct, including arguing on the job, is strictly prohibited.',
      'y. The Hauler is not responsible for resolving operational or project related issues and must defer such matters to the CCG dispatcher.',
      'z. The Hauler shall not leave the job site early and must remain assigned until formally released from all duties by the CCG dispatcher or Earle personnel.',
      'aa. Day Shift: If an assignment is completed prior to the end of an 8 hour shift, the Hauler must notify the CCG dispatcher. CCG will make reasonable efforts to assign additional work in order to complete the 8 hour shift.',
      'bb. Day Shift: CCG will not be responsible for lost time if the Hauler fails to notify the dispatcher or request additional assignments prior to the completion of the 8 hour shift.',
      'cc. Night Shift: An 8 hour minimum guarantee will be honored. This guarantee will be forfeited if the truck arrives late for the assigned shift.',
      'dd. Night Shift: At will early dismissal will forfeit the 8 hour guarantee.',
      'ee. Night Shift: A 2 hour show up time will be warranted if the truck is not late and the job is canceled while staging.',
      'ff. Walter R. Earle Transit, LLC operates under a ticketless tracking system, which all Haulers must comply with.',
      'gg. When a GPS Tracker device is assigned, the Hauler must ensure the device is plugged in at least 15 minutes prior to check in and disconnected at check out. As an alternative, the device may remain connected at all times. Hauler is responsible to make sure the GPS Tracker device is properly functioning at all times. NO TRACKING — NO PAYMENT',
      'hh. If Hauler does not have a GPS Tracker device, driver must check in/out using the FleetWatcher App.',
      'NO TRACKING — NO PAYMENT',
      'ii. The GPS Tracker device and FleetWatcher App are critical for resolving disputes. Failure to maintain compliance, Hauler will forfeit the opportunity to dispute.',
      'jj. The Hauler is financially responsible for any GPS Tracker that is lost, stolen, or damaged, regardless of cause, and will be back-charged for the cost of replacement.',
      'kk. It is the Hauler’s responsibility to verify check in and check out times with Earle personnel, particularly prior to leaving the job site.',
      'll. In the event of an asphalt plant breakdown, the Hauler must mobilize to an alternate plant or assignment as directed by the CCG dispatcher, and the assignment will remain subject to completion.',
      'mm. CCG reserves the right to remove from service any truck or driver that fails to comply with jobsite safety requirements, dispatcher instructions, or the protocols outlined in this document.',
      'nn. All trucks and drivers must comply with all applicable federal, state, and local laws, including NJDOT safety regulations.',
    ],
  },
];

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

export const buildLegacyDriverProtocolHtml = () => LEGACY_DRIVER_PROTOCOL_CONTENT
  .map((section) => {
    const items = section.body
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join('');

    return `<section><h3>${escapeHtml(section.heading)}</h3><ol>${items}</ol></section>`;
  })
  .join('');
