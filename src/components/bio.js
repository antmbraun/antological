/**
 * Bio component that queries for data
 * with Gatsby's useStaticQuery component
 *
 * See: https://www.gatsbyjs.com/docs/how-to/querying-data/use-static-query/
 */

import * as React from "react"
import { StaticImage } from "gatsby-plugin-image"

const Bio = () => {
  
  return (
    <div className="bio">
      <StaticImage
        className="bio-avatar"
        layout="fixed"
        formats={["auto", "webp", "avif"]}
        src="../images/profile-pic.jpeg"
        width={50}
        height={50}
        quality={95}
        alt="Anthony Braun"
      />
      <p>
        I'm Anthony (Ant) Braun, a  <a href="https://www.linkedin.com/in/anthonybraun/">software engineer at Mindbody</a> and an <a href="https://www.instagram.com/antventurz">adventurer</a> based in Washington, DC but often somewhere else. <a href="mailto:antmbraun@gmail.com">Email me</a>.
      </p>
    </div>
  )
}
export default Bio
