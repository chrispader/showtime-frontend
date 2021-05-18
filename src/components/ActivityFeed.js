import React, { useEffect } from 'react'
import ActivityCard from './ActivityCard'

export default function ActivityFeed({
	activity,
	setItemOpenInModal,
	//removeItemFromFeed,
	removeActorFromFeed,
	setReportModalIsOpen,
}) {
	let windowObj
	useEffect(() => {
		windowObj = window
		return () => {
			windowObj = null
		}
	}, [])
	return (
		<div className="sm:px-3 overflow-hidden" style={{ maxWidth: windowObj?.innerWidth }}>
			{activity.map(act => (
				<ActivityCard act={act} key={act.id} setItemOpenInModal={setItemOpenInModal} setReportModalIsOpen={setReportModalIsOpen} removeActorFromFeed={removeActorFromFeed} />
			))}
		</div>
	)
}
