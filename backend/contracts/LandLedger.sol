// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title LandLedger
 * @notice Append-only on-chain ledger for LedgerLand.
 *         Each record stores an author address, a block timestamp,
 *         and an arbitrary JSON payload string.
 */
contract LandLedger {
    struct Record {
        address author;
        uint256 timestamp;
        string payload;
    }

    Record[] private _records;

    event RecordAdded(uint256 indexed index, address indexed author, uint256 timestamp);

    /**
     * @notice Append a new record to the ledger.
     * @param jsonPayload Arbitrary JSON string to store permanently.
     * @return index The zero-based index of the newly stored record.
     */
    function addRecord(string calldata jsonPayload) external returns (uint256 index) {
        index = _records.length;
        _records.push(Record({
            author: msg.sender,
            timestamp: block.timestamp,
            payload: jsonPayload
        }));
        emit RecordAdded(index, msg.sender, block.timestamp);
    }

    /**
     * @notice Read a single record by index.
     * @param index Zero-based record index.
     * @return author  The address that stored the record.
     * @return timestamp  The block timestamp when it was stored.
     * @return payload    The JSON payload string.
     */
    function getRecord(uint256 index) external view returns (
        address author,
        uint256 timestamp,
        string memory payload
    ) {
        require(index < _records.length, "Index out of bounds");
        Record storage r = _records[index];
        return (r.author, r.timestamp, r.payload);
    }

    /**
     * @notice How many records exist on the ledger.
     */
    function recordCount() external view returns (uint256) {
        return _records.length;
    }
}
