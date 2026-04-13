// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LandLedger
 * @notice Append-only registry of JSON payloads anchored on-chain for the LedgerLand prototype.
 * @dev The API relayer signs transactions; off-chain JWT identity is embedded inside `jsonPayload`.
 */
contract LandLedger {
    struct Record {
        address author;
        uint256 timestamp;
        string jsonPayload;
    }

    Record[] private records;

    event RecordAppended(
        uint256 indexed index,
        address indexed author,
        uint256 timestamp,
        string jsonPayload
    );

    /**
     * @notice Stores a new immutable record at the end of the array.
     * @param jsonPayload UTF-8 JSON string produced by the backend (includes actor metadata).
     */
    function appendRecord(string calldata jsonPayload) external {
        uint256 idx = records.length;
        records.push(
            Record({author: msg.sender, timestamp: block.timestamp, jsonPayload: jsonPayload})
        );
        emit RecordAppended(idx, msg.sender, block.timestamp, jsonPayload);
    }

    /// @return Total number of on-chain records (excluding the Solidity contract bytecode itself).
    function recordCount() external view returns (uint256) {
        return records.length;
    }

    /**
     * @param index Zero-based record offset.
     * @return author Relayer or wallet that submitted the transaction.
     * @return timestamp Block timestamp when mined.
     * @return jsonPayload Stored JSON string.
     */
    function getRecord(uint256 index) external view returns (address author, uint256 timestamp, string memory jsonPayload) {
        Record storage r = records[index];
        return (r.author, r.timestamp, r.jsonPayload);
    }
}
