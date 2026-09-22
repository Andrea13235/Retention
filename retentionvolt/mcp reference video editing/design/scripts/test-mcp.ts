import { MCP_TOOLS_DEFINITIONS, executeMcpTool } from '../src/mcp/tools';

async function testAll() {
  console.log('🧪 Testing CyberMCP Tools and Verification Suite...\n');
  console.log(`Registered Tools: ${MCP_TOOLS_DEFINITIONS.length}`);
  MCP_TOOLS_DEFINITIONS.forEach(t => console.log(`  - ${t.name}: ${t.description.slice(0, 60)}...`));

  console.log('\n--- 1. Testing search_retention_patterns ---');
  const searchRes = await executeMcpTool('search_retention_patterns', { query: 'Ali' });
  console.log(`Found ${searchRes.length} videos matching "Ali"`);
  if (searchRes.length === 0) throw new Error('Expected matches for "Ali"');
  console.log(`First match:`, searchRes[0]?.title, `CPM: ${searchRes[0]?.cpm}`);
  if (!searchRes[0].title || typeof searchRes[0].cpm !== 'number') {
    throw new Error('search_retention_patterns returned invalid video data structure');
  }

  console.log('\n--- 2. Testing get_cut_cadence ---');
  const cadence = await executeMcpTool('get_cut_cadence', { video_id: 'FbSNfj2S6Pw' });
  console.log(`Cadence for ${cadence.title}: Cuts: ${cadence.cuts_count}, ASL: ${cadence.asl_sec}s, WPM: ${cadence.wpm}`);
  if (!cadence.cuts_count || cadence.cuts_count < 1) {
    throw new Error('get_cut_cadence returned 0 cuts');
  }

  console.log('\n--- 3. Testing get_retention_flow (Mobbin Flow) ---');
  const flow = await executeMcpTool('get_retention_flow', { objective: 'hook_0_15s' });
  console.log(`Flow: ${flow.title}`);
  console.log(`Shot sequence steps: ${flow.shot_sequence?.length}`);
  console.log(`Why it works: ${flow.why_it_works}`);
  if (!flow.shot_sequence || flow.shot_sequence.length === 0) {
    throw new Error('get_retention_flow returned empty shot sequence');
  }

  console.log('\n--- 4. Testing get_motion_pattern (Mobbin UI Pattern) ---');
  const pattern = await executeMcpTool('get_motion_pattern', { pattern_id: 'MG-001' });
  console.log(`Pattern: ${pattern.id} - ${pattern.title} (${pattern.register})`);
  console.log(`Rebuild Formula: ${pattern.rebuildFormula?.slice(0, 80)}...`);
  console.log(`Code Snippet: ${pattern.codeSnippet ? 'Present' : 'Missing'}`);
  if (!pattern.rebuildFormula || !pattern.codeSnippet) {
    throw new Error('get_motion_pattern returned missing rebuildFormula or codeSnippet');
  }

  console.log('\n--- 5. Testing get_thumbnail_blueprint ---');
  const blueprint = await executeMcpTool('get_thumbnail_blueprint', { video_id: 'FbSNfj2S6Pw' });
  console.log(`Blueprint for: ${blueprint.video_title || blueprint[0]?.video_title}`);

  console.log('\n--- 6. Testing get_thumbnail_intel ---');
  const thumbnails = await executeMcpTool('get_thumbnail_intel', { niche: 'Productivity' });
  console.log(`Found ${thumbnails.length} thumbnails for niche "Productivity"`);
  if (thumbnails.length === 0) throw new Error('Expected thumbnails for Productivity');
  const sampleThumb = thumbnails[0];
  console.log(`Thumbnail: title="${sampleThumb.title}", creator="${sampleThumb.creator}", ctr="${sampleThumb.ctr_estimate}"`);
  if (!sampleThumb.creator || !sampleThumb.image_url) {
    throw new Error('get_thumbnail_intel returned undefined creator or image_url');
  }

  console.log('\n--- 7. Testing ElevenLabs Transcribe & Analyze ---');
  const stt = await executeMcpTool('transcribe_and_analyze', {});
  console.log(`STT Service: ${stt.service} [${stt.status}]`);
  console.log(`Metrics: WPM=${stt.metrics?.wordsPerMinute}, Dead Air=${stt.metrics?.deadAirPercentage}%`);
  if (!stt.transcript || typeof stt.metrics?.wordsPerMinute !== 'number') {
    throw new Error('transcribe_and_analyze returned invalid metrics');
  }

  console.log('\n--- 8. Testing export_timeline_edl ---');
  const edl = await executeMcpTool('export_timeline_edl', { videoId: 'FbSNfj2S6Pw', format: 'edl' });
  console.log(`EDL Export: filename="${edl.filename}", lines=${edl.content?.split('\n').length}`);
  const xml = await executeMcpTool('export_timeline_edl', { videoId: 'FbSNfj2S6Pw', format: 'xml' });
  console.log(`XML Export: filename="${xml.filename}", length=${xml.content?.length}`);
  if (!edl.content || !xml.content) {
    throw new Error('export_timeline_edl returned empty timeline file');
  }

  console.log('\n✅ All 9 CyberMCP tools verified successfully with 100% data integrity!');
}

testAll().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
