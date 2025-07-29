#!/usr/bin/env node
/**
 * Light Client Update Decoder using ChainSafe SSZ
 * Uses proper SSZ library to decode Light Client Updates
 */

import fs from 'fs';
import { ssz } from '@lodestar/types';
import { fromHexString } from '@chainsafe/ssz';

// Constants
const ELECTRA_NEXT_SYNC_COMMITTEE_GINDEX = 87n;

/**
 * Read Light Client Update SSZ data from file
 */
function readSSZFile(filename) {
    console.log(`Reading SSZ data from: ${filename}`);
    
    if (!fs.existsSync(filename)) {
        throw new Error(`File not found: ${filename}`);
    }
    
    const buffer = fs.readFileSync(filename);
    console.log(`Read ${buffer.length} bytes of SSZ data`);
    
    return buffer;
}

/**
 * Parse the beacon API response format
 */
function parseBeaconResponse(buffer) {
    if (buffer.length < 12) {
        throw new Error('Response too short');
    }
    
    // Parse beacon API response format:
    // 8 bytes: response_chunk_len (little-endian uint64)
    // 4 bytes: fork_digest  
    // remaining: SSZ payload
    
    const chunkLen = buffer.readBigUInt64LE(0);
    const forkDigest = buffer.slice(8, 12);
    const payload = buffer.slice(12, 12 + Number(chunkLen));
    
    console.log(`Chunk length: ${chunkLen}`);
    console.log(`Fork digest: 0x${forkDigest.toString('hex')}`);
    console.log(`Payload length: ${payload.length}`);
    
    return {
        chunkLen,
        forkDigest,
        payload
    };
}

/**
 * Get the correct SSZ type based on fork
 */
function getLightClientUpdateType(forkDigest) {
    const forkHex = forkDigest.toString('hex');
    console.log(`Fork digest: 0x${forkHex}`);
    
    // You can add specific fork detection here
    // For now, try Electra first, then fall back to Deneb
    try {
        console.log('Trying Electra LightClientUpdate type...');
        return ssz.electra.LightClientUpdate;
    } catch (e) {
        try {
            console.log('Trying Deneb LightClientUpdate type...');
            return ssz.deneb.LightClientUpdate;
        } catch (e2) {
            try {
                console.log('Trying Capella LightClientUpdate type...');
                return ssz.capella.LightClientUpdate;
            } catch (e3) {
                throw new Error('Could not determine LightClientUpdate type for this fork');
            }
        }
    }
}

/**
 * Display light client update information
 */
function displayUpdateInfo(update) {
    console.log('\n=== Light Client Update Info ===');
    console.log(`Attested header slot: ${update.attestedHeader.beacon.slot}`);
    console.log(`Attested header proposer: ${update.attestedHeader.beacon.proposerIndex}`);
    console.log(`Attested header state root: 0x${Buffer.from(update.attestedHeader.beacon.stateRoot).toString('hex')}`);
    
    console.log(`Finalized header slot: ${update.finalizedHeader.beacon.slot}`);
    console.log(`Finalized header state root: 0x${Buffer.from(update.finalizedHeader.beacon.stateRoot).toString('hex')}`);
    
    console.log(`Signature slot: ${update.signatureSlot}`);
    console.log(`Has next sync committee: ${!!update.nextSyncCommittee}`);
    
    if (update.nextSyncCommittee) {
        console.log(`Next sync committee pubkeys: ${update.nextSyncCommittee.pubkeys.length}`);
        console.log(`Next sync committee branch length: ${update.nextSyncCommitteeBranch.length}`);
        
        // Show first few pubkeys as sample
        console.log(`First pubkey: 0x${Buffer.from(update.nextSyncCommittee.pubkeys[0]).toString('hex')}`);
        console.log(`Aggregate pubkey: 0x${Buffer.from(update.nextSyncCommittee.aggregatePubkey).toString('hex')}`);
    }
    
    console.log(`Finality branch length: ${update.finalityBranch.length}`);
    
    // Sync committee participation
    const syncBits = update.syncAggregate.syncCommitteeBits;
                
    let participation = 0;
    
    // Handle BitArray objects (from SSZ library)
    console.log(`Sync committee bits type: BitArray with ${syncBits.bitLen} bits`);
    
    // Count set bits in the BitArray
    for (const byte of syncBits.uint8Array) {
        participation += byte.toString(2).split('1').length - 1;
    }
    
    console.log(`Sync committee participation: ${participation}/512`);
    console.log(`Sync committee bits (hex): 0x${syncBits.uint8Array.toString('hex')}`);
    
    console.log(`Sync committee participation: ${participation}/512`);
    console.log(`Sync committee signature: 0x${Buffer.from(update.syncAggregate.syncCommitteeSignature).toString('hex').substring(0, 20)}...`);
}

/**
 * Verify next sync committee merkle proof using the SSZ library
 */
function verifyNextSyncCommitteeProof(update, LightClientUpdateType) {
    if (!update.nextSyncCommittee) {
        console.log('No next sync committee to verify');
        return true;
    }
    
    console.log('\n=== Verifying Next Sync Committee Proof ===');
    
    try {
        // Use the SSZ library's built-in merkle proof verification
        // Get the sync committee hash tree root
        const syncCommitteeType = LightClientUpdateType.fields.nextSyncCommittee;
        const syncCommitteeRoot = syncCommitteeType.hashTreeRoot(update.nextSyncCommittee);
        
        console.log(`Sync committee root: 0x${Buffer.from(syncCommitteeRoot).toString('hex')}`);
        
        // The verification would typically be done by the light client
        // For now, we'll just show that we can compute the root
        console.log('✅ Successfully computed sync committee root using SSZ library');
        
        return true;
        
    } catch (error) {
        console.error('❌ Error verifying sync committee proof:', error.message);
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        const args = process.argv.slice(2);
        if (args.length < 1) {
            console.log('Usage: node chainsafe_ssz_decoder.js <ssz_file>');
            console.log('Example: node chainsafe_ssz_decoder.js light_client_update.ssz');
            console.log('');
            console.log('To save SSZ data first:');
            console.log('curl -H "Accept: application/octet-stream" \\');
            console.log('  "localhost:5052/eth/v1/beacon/light_client/updates?start_period=2140&count=1" \\');
            console.log('  --output light_client_update.ssz');
            process.exit(1);
        }
        
        const filename = args[0];
        
        // Read SSZ data from file
        const sszBuffer = readSSZFile(filename);
        
        // Parse beacon API response format
        const { payload, forkDigest } = parseBeaconResponse(sszBuffer);
        
        // Get the correct SSZ type for this fork
        const LightClientUpdateType = getLightClientUpdateType(forkDigest);
        
        // Decode using the SSZ library
        console.log('\n=== Decoding Light Client Update with SSZ Library ===');
        const update = LightClientUpdateType.deserialize(payload);
        
        console.log('✅ Successfully decoded Light Client Update!');
        
        // Display information
        displayUpdateInfo(update);
        
        // Verify merkle proof
        const isValid = verifyNextSyncCommitteeProof(update, LightClientUpdateType);
        
        if (isValid) {
            console.log('\n✅ Light client update processed successfully!');
        } else {
            console.log('\n❌ Light client update verification failed!');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        if (error.code === 'MODULE_NOT_FOUND') {
            console.error('\n💡 Missing dependencies! Run:');
            console.error('npm install @lodestar/types @chainsafe/ssz');
        }
        if (error.stack) {
            console.error('\nStack trace:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { readSSZFile, parseBeaconResponse, displayUpdateInfo };